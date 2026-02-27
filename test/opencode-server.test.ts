import { expect, test, vi } from "vitest";
import { logger } from "~/lib/logger";
import { OpencodeServer } from "~/lib/opencode-server";
import { Profile } from "~/lib/profile";
import { textEncoder } from "~/lib/text-encoder";
import pkg from "~/package.json" with { type: "json" };

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
}));

const profile = await Profile.create("test");

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
  const opencodeServer = await OpencodeServer.create(profile);
  expect(opencodeServer.client).toBeDefined();
});

test("logs ready", async () => {
  mockSpawn();
  await OpencodeServer.create(profile);
  expect(logger.info).toHaveBeenCalledWith("OpenCode server is ready");
});

test("passes credentials to opencode server", async () => {
  mockSpawn();
  await OpencodeServer.create(profile);
  expect(capturedOptions).toMatchObject({
    env: {
      OPENCODE_SERVER_USERNAME: pkg.name,
      OPENCODE_SERVER_PASSWORD: expect.stringMatching(/^[\w-]{43}$/),
    },
  });
});

test("passes opencode config dir to opencode server", async () => {
  mockSpawn();
  await OpencodeServer.create(profile);
  expect(capturedOptions).toMatchObject({
    env: { OPENCODE_CONFIG_DIR: profile.opencode },
  });
});

test("passes profile xdg paths to opencode server", async () => {
  mockSpawn();
  await OpencodeServer.create(profile);
  expect(capturedOptions).toMatchObject({
    env: {
      XDG_DATA_HOME: profile.xdgData,
      XDG_CONFIG_HOME: profile.xdgConfig,
      XDG_STATE_HOME: profile.xdgState,
      XDG_CACHE_HOME: profile.xdgCache,
    },
  });
});

test("spawns in profile workspace directory", async () => {
  mockSpawn();
  await OpencodeServer.create(profile);
  expect(capturedOptions).toMatchObject({ cwd: profile.workspace });
});

test("spawns detached from parent process group", async () => {
  mockSpawn();
  await OpencodeServer.create(profile);
  expect(capturedOptions).toMatchObject({ detached: true });
});

test("is async disposable", async () => {
  const kill = mockSpawnPending();
  {
    await using _opencodeServer = await OpencodeServer.create(profile);
  }
  expect(kill).toHaveBeenCalledOnce();
});

test("logs start", async () => {
  mockSpawn();
  await OpencodeServer.create(profile);
  expect(logger.debug).toHaveBeenCalledWith("OpenCode server is starting…");
});

test("logs stopped on exit", async () => {
  mockSpawn();
  const opencodeServer = await OpencodeServer.create(profile);
  await opencodeServer.exited.catch(() => {});
  expect(logger.info).toHaveBeenCalledWith("OpenCode server is stopped", {
    signalCode: null,
    exitCode: 0,
    osError: undefined,
  });
});

test("logs stopped with osError on abnormal exit", async () => {
  const error = new Error("waitpid2 failed");
  mockSpawn({ onExitError: error });
  const opencodeServer = await OpencodeServer.create(profile);
  await opencodeServer.exited.catch(() => {});
  expect(logger.info).toHaveBeenCalledWith("OpenCode server is stopped", {
    signalCode: null,
    exitCode: null,
    osError: error,
  });
});

test("exited rejects on unexpected exit", async () => {
  mockSpawn();
  const opencodeServer = await OpencodeServer.create(profile);
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
    const opencodeServer = await OpencodeServer.create(profile);
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
    await using opencodeServer = await OpencodeServer.create(profile);
    processExited = opencodeServer.exited;
  }
  await expect(processExited).resolves.toBeUndefined();
});

test("parses port split across chunks", async () => {
  mockSpawn({ chunks: ["listening on", " :3000\n"] });
  const opencodeServer = await OpencodeServer.create(profile);
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
    await using _opencodeServer = await OpencodeServer.create(profile);
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
    await using _opencodeServer = await OpencodeServer.create(profile);
  }
  expect(kill).toHaveBeenCalledOnce();
});

test("throws if port not found", async () => {
  mockSpawn({ chunks: ["no port here\n"] });
  await expect(OpencodeServer.create(profile)).rejects.toThrow(
    "OpenCode server exited without announcing port",
  );
});

test("throws if listening line has no port", async () => {
  mockSpawn({ chunks: ["listening\n"] });
  await expect(OpencodeServer.create(profile)).rejects.toThrow(
    "OpenCode server exited without announcing port",
  );
});
