import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { createOpencodeClient } from "@opencode-ai/sdk/v2/client";
import { consola } from "consola";
import type { OpencodeServer } from "~/lib/opencode-server";
import { textDecoder } from "~/lib/text-decoder";
import pkg from "~/package.json" with { type: "json" };

interface Proc {
  kill(signal?: number): void;
  readonly exited: Promise<number>;
  readonly stdout: ReadableStream<Uint8Array>;
}

async function killProc(proc: Proc): Promise<void> {
  proc.kill();
  const forceKill = setTimeout(() => proc.kill(9), 10_000);
  try {
    await proc.exited;
  } finally {
    clearTimeout(forceKill);
  }
}

interface ReadPortResult {
  readonly port: number;
  readonly stdout: ReadableStream<Uint8Array>;
}

async function readPort(proc: Proc): Promise<ReadPortResult> {
  const reader = proc.stdout.getReader();
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
        if (match) return { port: Number(match[1]), stdout: proc.stdout };
      }
    }
    throw new Error("opencode server exited without announcing port");
  } catch (error) {
    await killProc(proc);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

interface DrainDone {
  readonly done: true;
}

// Race each read against an abort promise so the caller can break out even
// if the stream never closes.
async function drain(stream: ReadableStream, signal: AbortSignal) {
  const reader = stream.getReader();

  // Resolves to { done: true } on abort, matching reader.read() shape.
  const controller = new AbortController();
  const aborted = new Promise<DrainDone>((r) =>
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

export async function opencodeServe(): Promise<OpencodeServer> {
  const username = pkg.name;
  const password = randomBytes(32).toString("base64url");
  consola.start("OpenCode server is starting");
  const proc = Bun.spawn(
    [bin, "serve", "--hostname", "127.0.0.1", "--port", "0"],
    {
      stdout: "pipe",
      stderr: "ignore",
      detached: true,
      env: {
        ...Bun.env,
        OPENCODE_SERVER_USERNAME: username,
        OPENCODE_SERVER_PASSWORD: password,
      },
      onExit(_proc, exitCode, signalCode, error) {
        consola.info("OpenCode server is stopped", {
          signalCode,
          exitCode,
          osError: error,
        });
      },
    },
  );

  const { port, stdout } = await readPort(proc);

  // Aborted in dispose to stop draining in case the stdout stream doesn't
  // close when the child process exits.
  const drainController = new AbortController();
  const drained = drain(stdout, drainController.signal).then(
    () => {},
    () => {},
  );

  // Only reject if the process exits on its own, not when we kill it.
  let disposed = false;
  const exited = proc.exited.then((code) => {
    if (disposed) return;
    throw new Error(`opencode server exited unexpectedly (${code})`);
  });

  // exited rejects on unexpected exit but may not be awaited immediately by
  // the consumer. Without this handler, the rejection would be unhandled.
  exited.then(
    () => {},
    () => {},
  );

  consola.ready("OpenCode server is ready");

  return {
    exited,
    client: createOpencodeClient({
      baseUrl: `http://127.0.0.1:${port}`,
      headers: {
        authorization: `Basic ${btoa(`${username}:${password}`)}`,
      },
      throwOnError: true,
    }),
    [Symbol.asyncDispose]: async () => {
      disposed = true;
      await killProc(proc);
      drainController.abort();
      await Promise.all([drained, exited]);
    },
  };
}
