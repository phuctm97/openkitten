import { resolve } from "node:path";
import { consola } from "consola";
import type { OpenCodeProcess } from "~/lib/opencode-process";
import { textDecoder } from "~/lib/text-decoder";

interface ReadPortResult {
  port: number;
  rest: ReadableStream<Uint8Array>;
}

async function readPort(
  stdout: ReadableStream<Uint8Array>,
): Promise<ReadPortResult> {
  const reader = stdout.getReader();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += textDecoder.decode(value);
      for (;;) {
        const newline = buffer.indexOf("\n");
        if (newline === -1) break;
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line.includes("listening")) continue;
        const match = line.match(/:(\d+)/);
        if (match) return { port: Number(match[1]), rest: stdout };
      }
    }
    throw new Error("opencode exited without announcing port");
  } finally {
    reader.releaseLock();
  }
}

async function drain(stream: ReadableStream) {
  for await (const _ of stream) {
    // Discard
  }
}

const bin = resolve(import.meta.dirname, "../node_modules/.bin/opencode");

export async function createOpenCodeProcess(): Promise<OpenCodeProcess> {
  const proc = Bun.spawn([bin, "serve"], {
    stdout: "pipe",
    stderr: "ignore",
    onExit(_proc, exitCode, signalCode, error) {
      consola.log("opencode exit info", { exitCode, signalCode });
      if (error) consola.error("opencode exit error", error);
    },
  });

  const { port, rest } = await readPort(proc.stdout);

  const drained = drain(rest);
  let disposed = false;
  const exited = proc.exited.then((code) => {
    if (disposed) return;
    throw new Error(`opencode exited unexpectedly (${code})`);
  });

  const pending = [drained, exited];

  // Prevent unhandled rejections for floating promises awaited later in dispose
  for (const p of pending)
    p.catch(() => {
      // Ignore
    });

  return {
    port,
    exited,
    [Symbol.asyncDispose]: async () => {
      disposed = true;
      proc.kill();
      await Promise.all(pending);
    },
  };
}
