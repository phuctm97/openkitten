import { resolve } from "node:path";
import type { OpenCode } from "~/lib/opencode";
import { textDecoder } from "~/lib/text-decoder";

interface ReadPortResult {
  port: number;
  rest: ReadableStream<Uint8Array>;
}

async function readPort(
  stdout: ReadableStream<Uint8Array>,
): Promise<ReadPortResult> {
  const reader = stdout.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const line = textDecoder.decode(value);
      if (!line.includes("listening")) continue;
      const match = line.match(/:(\d+)/);
      if (match) return { port: Number(match[1]), rest: stdout };
    }
    throw new Error("opencode exited without announcing port");
  } finally {
    reader.releaseLock();
  }
}

async function drain(stream: ReadableStream) {
  for await (const _ of stream) {
    // discard
  }
}

const bin = resolve(import.meta.dirname, "../node_modules/.bin/opencode");

export async function createOpenCode(): Promise<OpenCode> {
  const proc = Bun.spawn([bin, "serve"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const drainStderr = drain(proc.stderr);
  const { port, rest } = await readPort(proc.stdout);
  const drainStdout = drain(rest);

  let disposed = false;
  const exited = proc.exited.then((code) => {
    if (disposed) return;
    throw new Error(`opencode exited unexpectedly with code ${code}`);
  });
  exited.catch(() => {
    // Prevent unhandled rejection if caller doesn't await exited before dispose
  });

  return {
    port,
    exited,
    [Symbol.asyncDispose]: async () => {
      disposed = true;
      proc.kill();
      await Promise.all([proc.exited, drainStdout, drainStderr]);
    },
  };
}
