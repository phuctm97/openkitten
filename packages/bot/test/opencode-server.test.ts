import { createOpencodeClient } from "@opencode-ai/sdk/v2/client";
import { expect, test, vi } from "vitest";
import { logger } from "~/lib/logger";
import type { OpencodeConfig } from "~/lib/opencode-config";
import { OpencodeServer } from "~/lib/opencode-server";
import { textEncoder } from "~/lib/text-encoder";

vi.mock("@opencode-ai/sdk/v2/client", () => ({
  createOpencodeClient: vi.fn().mockReturnValue({ mock: true }),
}));

const config: OpencodeConfig = {
  bin: "/mock/opencode",
  cwd: "/mock/workspace",
  env: { MOCK: "true" },
  authorization: "Basic mock",
};

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
  readonly chunks?: readonly string[];
  readonly onExitError?: Error;
}

let capturedOptions: Record<string, unknown> | undefined;

function mockSpawn(options?: MockSpawnOptions) {
  const chunks = options?.chunks ?? ["listening on :3000\n"];
  capturedOptions = undefined;
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
    capturedOptions = opts;
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
  const opencodeServer = await OpencodeServer.create(config);
  expect(opencodeServer.client).toBeDefined();
});

test("logs ready", async () => {
  mockSpawn();
  await OpencodeServer.create(config);
  expect(logger.info).toHaveBeenCalledWith("OpenCode server is ready");
});

test("passes authorization to client", async () => {
  mockSpawn();
  await OpencodeServer.create(config);
  expect(createOpencodeClient).toHaveBeenCalledWith(
    expect.objectContaining({
      headers: { authorization: "Basic mock" },
    }),
  );
});

test("passes config to spawn", async () => {
  mockSpawn();
  await OpencodeServer.create(config);
  expect(capturedOptions).toMatchObject({
    cwd: "/mock/workspace",
    env: { MOCK: "true" },
    detached: true,
  });
});

test("is async disposable", async () => {
  const kill = mockSpawnPending();
  {
    await using _opencodeServer = await OpencodeServer.create(config);
  }
  expect(kill).toHaveBeenCalledOnce();
});

test("logs start", async () => {
  mockSpawn();
  await OpencodeServer.create(config);
  expect(logger.debug).toHaveBeenCalledWith("OpenCode server is starting…");
});

test("logs stopped on exit", async () => {
  mockSpawn();
  const opencodeServer = await OpencodeServer.create(config);
  await opencodeServer.exited.catch(() => {});
  expect(logger.info).toHaveBeenCalledWith("OpenCode server is terminated", {
    signalCode: null,
    exitCode: 0,
    osError: undefined,
  });
});

test("logs stopped with osError on abnormal exit", async () => {
  const error = new Error("waitpid2 failed");
  mockSpawn({ onExitError: error });
  const opencodeServer = await OpencodeServer.create(config);
  await opencodeServer.exited.catch(() => {});
  expect(logger.info).toHaveBeenCalledWith("OpenCode server is terminated", {
    signalCode: null,
    exitCode: null,
    osError: error,
  });
});

test("exited rejects on unexpected exit", async () => {
  mockSpawn();
  const opencodeServer = await OpencodeServer.create(config);
  await expect(opencodeServer.exited).rejects.toThrow(
    "OpenCode server exited unexpectedly (0)",
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
    const opencodeServer = await OpencodeServer.create(config);
    const disposePromise = opencodeServer[Symbol.asyncDispose]();
    await vi.advanceTimersByTimeAsync(10_000);
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
    await using opencodeServer = await OpencodeServer.create(config);
    processExited = opencodeServer.exited;
  }
  await expect(processExited).resolves.toBeUndefined();
});

test("parses port split across chunks", async () => {
  mockSpawn({ chunks: ["listening on", " :3000\n"] });
  const opencodeServer = await OpencodeServer.create(config);
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
    await using _opencodeServer = await OpencodeServer.create(config);
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
    await using _opencodeServer = await OpencodeServer.create(config);
  }
  expect(kill).toHaveBeenCalledOnce();
});

test("throws if port not found", async () => {
  mockSpawn({ chunks: ["no port here\n"] });
  await expect(OpencodeServer.create(config)).rejects.toThrow(
    "OpenCode server exited without announcing port",
  );
});

test("throws if listening line has no port", async () => {
  mockSpawn({ chunks: ["listening\n"] });
  await expect(OpencodeServer.create(config)).rejects.toThrow(
    "OpenCode server exited without announcing port",
  );
});
