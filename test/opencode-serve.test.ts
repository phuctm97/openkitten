import { consola } from "consola";
import { expect, test, vi } from "vitest";
import { opencodeServe } from "~/lib/opencode-serve";
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

test("returns client", async () => {
  mockSpawn();
  const opencodeServer = await opencodeServe();
  expect(opencodeServer.client).toBeDefined();
});

test("logs ready", async () => {
  mockSpawn();
  await opencodeServe();
  expect(consola.ready).toHaveBeenCalledWith("opencode server is ready");
});

test("passes credentials to opencode server", async () => {
  mockSpawn();
  await opencodeServe();
  expect(capturedEnv).toMatchObject({
    OPENCODE_SERVER_USERNAME: pkg.name,
    OPENCODE_SERVER_PASSWORD: expect.stringMatching(/^[\w-]{43}$/),
  });
});

test("is async disposable", async () => {
  const kill = mockSpawnPending();
  {
    await using _opencodeServer = await opencodeServe();
  }
  expect(kill).toHaveBeenCalledOnce();
});

test("logs terminated on exit", async () => {
  mockSpawn();
  const opencodeServer = await opencodeServe();
  await opencodeServer.exited.catch(() => {});
  expect(consola.debug).toHaveBeenCalledWith("opencode server is terminated", {
    exitCode: 0,
    signalCode: null,
  });
});

test("logs abnormal exit", async () => {
  const error = new Error("waitpid2 failed");
  mockSpawn({ onExitError: error });
  const opencodeServer = await opencodeServe();
  await opencodeServer.exited.catch(() => {});
  expect(consola.fatal).toHaveBeenCalledWith(
    "opencode server exited abnormally",
    error,
  );
});

test("exited rejects on unexpected exit", async () => {
  mockSpawn();
  const opencodeServer = await opencodeServe();
  await expect(opencodeServer.exited).rejects.toThrow(
    "opencode server exited unexpectedly (0)",
  );
});

test("force kills after timeout", async () => {
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
    const opencodeServer = await opencodeServe();
    const disposePromise = opencodeServer[Symbol.asyncDispose]();
    await vi.advanceTimersByTimeAsync(5000);
    await disposePromise;
    expect(kill).toHaveBeenCalledWith(9);
  } finally {
    vi.useRealTimers();
  }
});

test("exited does not reject after dispose", async () => {
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
    await using opencodeServer = await opencodeServe();
    processExited = opencodeServer.exited;
  }
  await expect(processExited).resolves.toBeUndefined();
});

test("parses port split across chunks", async () => {
  mockSpawn({ chunks: ["listening on", " :3000\n"] });
  const opencodeServer = await opencodeServe();
  expect(opencodeServer.client).toBeDefined();
});

test("drains stdout until dispose", async () => {
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
    await using _opencodeServer = await opencodeServe();
    await vi.waitFor(() => expect(chunks).toBeGreaterThan(1));
  }
  expect(kill).toHaveBeenCalledOnce();
});

test("tolerates stdout stream error after port", async () => {
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
    await using _opencodeServer = await opencodeServe();
  }
  expect(kill).toHaveBeenCalledOnce();
});

test("throws if port not found", async () => {
  mockSpawn({ chunks: ["no port here\n"] });
  await expect(opencodeServe()).rejects.toThrow(
    "opencode server exited without announcing port",
  );
});

test("throws if listening line has no port", async () => {
  mockSpawn({ chunks: ["listening\n"] });
  await expect(opencodeServe()).rejects.toThrow(
    "opencode server exited without announcing port",
  );
});
