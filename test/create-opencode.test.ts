import { consola } from "consola";
import { expect, test, vi } from "vitest";
import { createOpencode } from "~/lib/create-opencode";
import { textEncoder } from "~/lib/text-encoder";
import pkg from "~/package.json" with { type: "json" };

type OnExit = (
  proc: unknown,
  exitCode: number | null,
  signalCode: number | null,
  error?: Error,
) => void;

function portStdout() {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(textEncoder.encode("listening on :3000\n"));
      controller.close();
    },
  });
}

interface MockSpawnOptions {
  readonly chunks?: string[];
  readonly onExitError?: Error;
}

let capturedEnv: Record<string, string> | undefined;

function mockSpawn(options?: MockSpawnOptions) {
  const chunks = options?.chunks ?? ["listening on :3000\n"];
  capturedEnv = undefined;
  const kill = vi.fn();
  const stdout = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(textEncoder.encode(chunk));
      }
      controller.close();
    },
  });
  return vi.spyOn(Bun, "spawn").mockImplementation(((
    _cmd: string[],
    opts: {
      readonly env?: Record<string, string>;
      readonly onExit?: OnExit;
    },
  ) => {
    capturedEnv = opts.env;
    const proc = {
      kill,
      stdout,
      exited: Promise.resolve(0).then((code) => {
        if (options?.onExitError) {
          opts.onExit?.(proc, null, null, options.onExitError);
        } else {
          opts.onExit?.(proc, code, null);
        }
        return code;
      }),
    };
    return proc;
  }) as never);
}

function mockSpawnPending(stdout = portStdout()) {
  let resolveExited: (code: number) => void;
  const exited = new Promise<number>((r) => {
    resolveExited = r;
  });
  const kill = vi.fn(() => resolveExited(0));
  vi.spyOn(Bun, "spawn").mockImplementation((() => ({
    kill,
    stdout,
    exited,
  })) as never);
  return kill;
}

test("createOpencode returns client", async () => {
  mockSpawn();
  const opencode = await createOpencode();
  expect(opencode.client).toBeDefined();
});

test("createOpencode logs ready", async () => {
  mockSpawn();
  await createOpencode();
  expect(consola.ready).toHaveBeenCalledWith("opencode is ready");
});

test("createOpencode passes credentials to opencode", async () => {
  mockSpawn();
  await createOpencode();
  expect(capturedEnv).toMatchObject({
    OPENCODE_SERVER_USERNAME: pkg.name,
    OPENCODE_SERVER_PASSWORD: expect.stringMatching(/^[\w-]{43}$/),
  });
});

test("createOpencode is async disposable", async () => {
  const kill = mockSpawnPending();
  {
    await using _opencode = await createOpencode();
  }
  expect(kill).toHaveBeenCalledOnce();
});

test("createOpencode logs stopped on exit", async () => {
  mockSpawn();
  const opencode = await createOpencode();
  await opencode.exited.catch(() => {});
  expect(consola.debug).toHaveBeenCalledWith("opencode is terminated", {
    exitCode: 0,
    signalCode: null,
  });
});

test("createOpencode logs abnormal exit", async () => {
  const error = new Error("waitpid2 failed");
  mockSpawn({ onExitError: error });
  const opencode = await createOpencode();
  await opencode.exited.catch(() => {});
  expect(consola.fatal).toHaveBeenCalledWith(
    "opencode exited abnormally",
    error,
  );
});

test("createOpencode.exited rejects on unexpected exit", async () => {
  mockSpawn();
  const opencode = await createOpencode();
  await expect(opencode.exited).rejects.toThrow(
    "opencode exited unexpectedly (0)",
  );
});

test("createOpencode force kills after timeout", async () => {
  vi.useFakeTimers();
  try {
    let resolveExited: (code: number) => void;
    const exited = new Promise<number>((r) => {
      resolveExited = r;
    });
    const kill = vi.fn((signal?: number) => {
      if (signal === 9) {
        resolveExited(0);
      }
    });
    vi.spyOn(Bun, "spawn").mockImplementation((() => ({
      kill,
      stdout: portStdout(),
      exited,
    })) as never);
    const opencode = await createOpencode();
    const disposePromise = opencode[Symbol.asyncDispose]();
    await vi.advanceTimersByTimeAsync(5000);
    await disposePromise;
    expect(kill).toHaveBeenCalledWith(9);
  } finally {
    vi.useRealTimers();
  }
});

test("createOpencode.exited does not reject after dispose", async () => {
  let resolveExited: (code: number) => void;
  const exited = new Promise<number>((r) => {
    resolveExited = r;
  });
  vi.spyOn(Bun, "spawn").mockImplementation(((
    _cmd: string[],
    opts: { readonly onExit?: OnExit },
  ) => {
    const proc = {
      kill: vi.fn(() => {
        resolveExited(0);
        opts.onExit?.(proc, 0, null);
      }),
      stdout: portStdout(),
      exited,
    };
    return proc;
  }) as never);
  let processExited: Promise<void>;
  {
    await using opencode = await createOpencode();
    processExited = opencode.exited;
  }
  await expect(processExited).resolves.toBeUndefined();
});

test("createOpencode parses port split across chunks", async () => {
  mockSpawn({ chunks: ["listening on", " :3000\n"] });
  const opencode = await createOpencode();
  expect(opencode.client).toBeDefined();
});

test("createOpencode drains stdout until dispose", async () => {
  let chunks = 0;
  const kill = mockSpawnPending(
    new ReadableStream<Uint8Array>({
      async pull(controller) {
        await new Promise((r) => setTimeout(r, 0));
        if (chunks === 0) {
          controller.enqueue(textEncoder.encode("listening on :3000\n"));
        } else {
          controller.enqueue(textEncoder.encode("log output\n"));
        }
        chunks++;
      },
    }),
  );
  {
    await using _opencode = await createOpencode();
    await vi.waitFor(() => expect(chunks).toBeGreaterThan(1));
  }
  expect(kill).toHaveBeenCalledOnce();
});

test("createOpencode tolerates stdout stream error after port", async () => {
  let enqueued = false;
  const kill = mockSpawnPending(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (!enqueued) {
          enqueued = true;
          controller.enqueue(textEncoder.encode("listening on :3000\n"));
        } else {
          controller.error(new Error("stdout broke"));
        }
      },
    }),
  );
  {
    await using _opencode = await createOpencode();
  }
  expect(kill).toHaveBeenCalledOnce();
});

test("createOpencode throws if port not found", async () => {
  mockSpawn({ chunks: ["no port here\n"] });
  await expect(createOpencode()).rejects.toThrow(
    "opencode exited without announcing port",
  );
});

test("createOpencode throws if listening line has no port", async () => {
  mockSpawn({ chunks: ["listening\n"] });
  await expect(createOpencode()).rejects.toThrow(
    "opencode exited without announcing port",
  );
});
