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

// Race each read against an abort promise so the caller can break out even
// if the stream never closes.
async function drain(stream: ReadableStream, signal: AbortSignal) {
  const reader = stream.getReader();
  // Resolves to { done: true } on abort, matching reader.read() shape.
  const controller = new AbortController();
  const aborted = new Promise<{ done: true }>((r) =>
    signal.addEventListener("abort", () => r({ done: true }), {
      once: true,
      // Auto-remove listener if the stream ends before abort.
      signal: controller.signal,
    }),
  );
  try {
    for (;;) {
      const result = await Promise.race([reader.read(), aborted]);
      if (result.done) break;
    }
  } finally {
    controller.abort();
    reader.releaseLock();
  }
}

const bin = resolve(import.meta.dirname, "../node_modules/.bin/opencode");

export async function createOpenCodeProcess(): Promise<OpenCodeProcess> {
  const proc = Bun.spawn([bin, "serve"], {
    stdout: "pipe",
    stderr: "ignore",
    onExit(_proc, exitCode, signalCode, error) {
      consola.debug("opencode exit info", { exitCode, signalCode });
      if (error) consola.fatal("opencode exit error", error);
    },
  });

  const { port, rest } = await readPort(proc.stdout);

  // Aborted in dispose to stop draining in case the stdout stream doesn't
  // close when the child process exits.
  const drainController = new AbortController();
  const drained = drain(rest, drainController.signal).catch(() => {});

  // Only reject if the process exits on its own, not when we kill it.
  let disposed = false;
  const exited = proc.exited.then((code) => {
    if (disposed) return;
    throw new Error(`opencode exited unexpectedly (${code})`);
  });

  // exited rejects on unexpected exit but may not be awaited immediately by
  // the consumer. Without this catch, the rejection would be unhandled.
  exited.catch(() => {});

  return {
    port,
    exited,
    [Symbol.asyncDispose]: async () => {
      disposed = true;
      proc.kill();
      // Force kill if the process doesn't exit within 5 seconds.
      const forceKill = setTimeout(() => proc.kill(9), 5000);
      try {
        // Stop draining stdout so drained resolves and dispose can complete.
        drainController.abort();
        await Promise.all([drained, exited]);
      } finally {
        clearTimeout(forceKill);
      }
    },
  };
}
