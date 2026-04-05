import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { createOpencodeClient } from "@opencode-ai/sdk/v2/client";
import { logger } from "~/lib/logger";
import type { OpencodeConfig } from "~/lib/opencode-config";
import { textDecoder } from "~/lib/text-decoder";

interface Proc {
  kill(signal?: number): void;
  readonly exited: Promise<number>;
  readonly stdout: ReadableStream<Uint8Array>;
}

async function killProc(proc: Proc): Promise<void> {
  proc.kill();
  // SIGKILL after 10s if the process doesn't exit gracefully.
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

// Parse the port from OpenCode server's stdout (e.g. "listening on :PORT").
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
    throw new Error("OpenCode server exited without announcing port");
  } catch (error) {
    await killProc(proc);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

interface DrainStreamResult {
  readonly done: true;
}

// Race each read against an abort promise so the caller can break out even
// if the stream never closes.
async function drainStream(stream: ReadableStream, signal: AbortSignal) {
  const reader = stream.getReader();
  const controller = new AbortController();
  const aborted = new Promise<DrainStreamResult>((r) =>
    signal.addEventListener("abort", () => r({ done: true }), {
      once: true,
      // Auto-remove listener if the stream ends before abort.
      signal: controller.signal,
    }),
  );
  try {
    for (;;) {
      const { done } = await Promise.race([reader.read(), aborted]);
      if (done) {
        await reader.cancel();
        break;
      }
    }
  } finally {
    reader.releaseLock();
    controller.abort();
  }
}

export class OpencodeServer implements AsyncDisposable {
  readonly #client: OpencodeClient;
  readonly #exited: Promise<void>;
  readonly #dispose: () => Promise<void>;

  private constructor(
    client: OpencodeClient,
    exited: Promise<void>,
    dispose: () => Promise<void>,
  ) {
    this.#client = client;
    this.#exited = exited;
    this.#dispose = dispose;
  }

  get client(): OpencodeClient {
    return this.#client;
  }

  get exited(): Promise<void> {
    return this.#exited;
  }

  async [Symbol.asyncDispose]() {
    await this.#dispose();
  }

  static async create({
    bin,
    cwd,
    env,
    authorization,
  }: OpencodeConfig): Promise<OpencodeServer> {
    logger.debug("OpenCode server is starting…");
    const proc = Bun.spawn(
      [bin, "serve", "--hostname", "127.0.0.1", "--port", "0"],
      {
        cwd,
        env,
        stdout: "pipe",
        stderr: "ignore",
        detached: true,
        onExit(_proc, exitCode, signalCode, osError) {
          logger.info("OpenCode server is terminated", {
            signalCode,
            exitCode,
            osError,
          });
        },
      },
    );
    const { port, stdout } = await readPort(proc);

    // Aborted in dispose to stop draining the stdout stream in case it doesn't
    // close when the child process exits.
    const drainController = new AbortController();
    const drained = drainStream(stdout, drainController.signal).then(
      () => {},
      () => {},
    );

    // Only reject if the process exits on its own, not when we kill it.
    let disposed = false;
    const exited = proc.exited.then((code) => {
      if (disposed) return;
      throw new Error(`OpenCode server exited unexpectedly (${code})`);
    });

    // exited rejects on unexpected exit but may not be awaited immediately by
    // the consumer. Without this handler, exited's rejection would be unhandled.
    // So settled always resolves regardless of exited's outcome.
    const settled = exited.then(
      () => {},
      () => {},
    );

    logger.info("OpenCode server is ready");

    const client = createOpencodeClient({
      baseUrl: `http://127.0.0.1:${port}`,
      headers: { authorization },
      throwOnError: true,
    });

    return new OpencodeServer(client, exited, async () => {
      disposed = true;
      await killProc(proc);
      drainController.abort();
      await Promise.all([drained, settled]);
    });
  }
}
