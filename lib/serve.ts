import { resolve } from "node:path";
import { defineCommand } from "citty";
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

export default defineCommand({
  meta: { description: "Start the OpenKitten server." },
  run: async () => {
    const bin = resolve(import.meta.dirname, "../node_modules/.bin/opencode");
    const proc = Bun.spawn([bin, "serve"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const kill = () => proc.kill();
    process.on("SIGINT", kill);
    process.on("SIGTERM", kill);

    drain(proc.stderr);

    const port = await readPort(proc.stdout);
    console.log(`opencode is listening on port ${port}`);

    await proc.exited;
  },
});
