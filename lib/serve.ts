import { resolve } from "node:path";
import { defineCommand } from "citty";

export default defineCommand({
  meta: { description: "Start the OpenKitten server." },
  run: async () => {
    const bin = resolve(import.meta.dirname, "../node_modules/.bin/opencode");
    const proc = Bun.spawn([bin, "serve"], {
      stdout: "inherit",
      stderr: "inherit",
    });

    const kill = () => proc.kill();
    process.on("SIGINT", kill);
    process.on("SIGTERM", kill);

    await proc.exited;
  },
});
