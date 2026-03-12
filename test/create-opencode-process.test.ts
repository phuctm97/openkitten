import { consola } from "consola";
import { expect, test, vi } from "vitest";
import { createOpenCodeProcess } from "~/lib/create-opencode-process";
import { textEncoder } from "~/lib/text-encoder";

type OnExit = (
  proc: unknown,
  exitCode: number | null,
  signalCode: number | null,
  error?: Error,
) => void;

function mockSpawn(...chunks: string[]) {
  if (chunks.length === 0) chunks = ["listening on :3000\n"];
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
    opts: { onExit?: OnExit },
  ) => {
    const proc = {
      kill,
      stdout,

      exited: Promise.resolve(0).then((code) => {
        opts.onExit?.(proc, code, null);
        return code;
      }),
    };
    return proc;
  }) as never);
}

test("createOpenCodeProcess parses port", async () => {
  mockSpawn();
  const opencodeProcess = await createOpenCodeProcess();
  expect(opencodeProcess.port).toBe(3000);
});

test("createOpenCodeProcess is async disposable", async () => {
  let resolveExited: (code: number) => void;
  const exited = new Promise<number>((r) => {
    resolveExited = r;
  });
  const kill = vi.fn(() => resolveExited(0));
  vi.spyOn(Bun, "spawn").mockImplementation((() => ({
    kill,
    stdout: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(textEncoder.encode("listening on :3000\n"));
        controller.close();
      },
    }),
    stderr: new ReadableStream({ start: (c) => c.close() }),
    exited,
  })) as never);
  {
    await using _opencodeProcess = await createOpenCodeProcess();
  }
  expect(kill).toHaveBeenCalledOnce();
});

test("createOpenCodeProcess logs on exit", async () => {
  mockSpawn();
  const opencodeProcess = await createOpenCodeProcess();
  await opencodeProcess.exited.catch(() => {});
  expect(consola.log).toHaveBeenCalledWith("opencode exit info", {
    exitCode: 0,
    signalCode: null,
  });
});

test("createOpenCodeProcess logs error on exit error", async () => {
  const error = new Error("waitpid2 failed");
  vi.spyOn(Bun, "spawn").mockImplementation(((
    _cmd: string[],
    opts: { onExit?: OnExit },
  ) => {
    const proc = {
      kill: vi.fn(),
      stdout: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(textEncoder.encode("listening on :3000\n"));
          controller.close();
        },
      }),
      exited: Promise.resolve(0).then((code) => {
        opts.onExit?.(proc, null, null, error);
        return code;
      }),
    };
    return proc;
  }) as never);
  const opencodeProcess = await createOpenCodeProcess();
  await opencodeProcess.exited.catch(() => {});
  expect(consola.error).toHaveBeenCalledWith("opencode exit error", error);
});

test("createOpenCodeProcess.exited rejects on unexpected exit", async () => {
  mockSpawn();
  const opencodeProcess = await createOpenCodeProcess();
  await expect(opencodeProcess.exited).rejects.toThrow(
    "opencode exited unexpectedly (0)",
  );
});

test("createOpenCodeProcess.exited does not reject after dispose", async () => {
  let resolveExited: (code: number) => void;
  const exited = new Promise<number>((r) => {
    resolveExited = r;
  });
  vi.spyOn(Bun, "spawn").mockImplementation(((
    _cmd: string[],
    opts: { onExit?: OnExit },
  ) => {
    const proc = {
      kill: vi.fn(() => {
        resolveExited(0);
        opts.onExit?.(proc, 0, null);
      }),
      stdout: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(textEncoder.encode("listening on :3000\n"));
          controller.close();
        },
      }),

      exited,
    };
    return proc;
  }) as never);
  let processExited: Promise<void>;
  {
    await using opencodeProcess = await createOpenCodeProcess();
    processExited = opencodeProcess.exited;
  }
  await expect(processExited).resolves.toBeUndefined();
});

test("createOpenCodeProcess parses port split across chunks", async () => {
  mockSpawn("listening on", " :3000\n");
  const opencodeProcess = await createOpenCodeProcess();
  expect(opencodeProcess.port).toBe(3000);
});

test("createOpenCodeProcess drains stdout until dispose", async () => {
  let resolveExited: (code: number) => void;
  const exited = new Promise<number>((r) => {
    resolveExited = r;
  });
  const kill = vi.fn(() => resolveExited(0));
  let chunks = 0;
  vi.spyOn(Bun, "spawn").mockImplementation((() => ({
    kill,
    stdout: new ReadableStream<Uint8Array>({
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
    stderr: new ReadableStream({ start: (c) => c.close() }),
    exited,
  })) as never);
  {
    await using _opencodeProcess = await createOpenCodeProcess();
    await vi.waitFor(() => expect(chunks).toBeGreaterThan(1));
  }
  expect(kill).toHaveBeenCalledOnce();
});

test("createOpenCodeProcess tolerates stdout stream error after port", async () => {
  let resolveExited: (code: number) => void;
  const exited = new Promise<number>((r) => {
    resolveExited = r;
  });
  const kill = vi.fn(() => resolveExited(0));
  let enqueued = false;
  vi.spyOn(Bun, "spawn").mockImplementation((() => ({
    kill,
    stdout: new ReadableStream<Uint8Array>({
      pull(controller) {
        if (!enqueued) {
          enqueued = true;
          controller.enqueue(textEncoder.encode("listening on :3000\n"));
        } else {
          controller.error(new Error("stdout broke"));
        }
      },
    }),
    stderr: new ReadableStream({ start: (c) => c.close() }),
    exited,
  })) as never);
  {
    await using _opencodeProcess = await createOpenCodeProcess();
  }
  expect(kill).toHaveBeenCalledOnce();
});

test("createOpenCodeProcess throws if port not found", async () => {
  mockSpawn("no port here\n");
  await expect(createOpenCodeProcess()).rejects.toThrow(
    "opencode exited without announcing port",
  );
});

test("createOpenCodeProcess throws if listening line has no port", async () => {
  mockSpawn("listening\n");
  await expect(createOpenCodeProcess()).rejects.toThrow(
    "opencode exited without announcing port",
  );
});
