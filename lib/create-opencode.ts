import { resolve } from "node:path";
import type { OpenCode } from "~/lib/opencode";
import { textDecoder } from "~/lib/text-decoder";

async function readPort(stdout: ReadableStream<Uint8Array>): Promise<number> {
  for await (const chunk of stdout) {
    const line = textDecoder.decode(chunk);
    if (!line.includes("listening")) continue;
    const match = line.match(/:(\d+)/);
    if (match) return Number(match[1]);
  }
  throw new Error("opencode exited without announcing port");
}

async function drain(stream: ReadableStream) {
  for await (const _ of stream) {
    // discard
  }
}

export async function createOpenCode(): Promise<OpenCode> {
  const bin = resolve(import.meta.dirname, "../node_modules/.bin/opencode");
  const proc = Bun.spawn([bin, "serve"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  // TODO: drain stdout after reading port to prevent pipe buffer from blocking
  drain(proc.stderr);

  const port = await readPort(proc.stdout);

  return {
    port,
    [Symbol.asyncDispose]: async () => {
      proc.kill();
      await proc.exited;
    },
  };
}
