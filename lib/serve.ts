import { defineCommand } from "citty";
import { consola } from "consola";
import { createOpenCode } from "~/lib/create-opencode";

export const serve = defineCommand({
  meta: { description: "Start the OpenKitten server." },
  run: async () => {
    await using opencode = await createOpenCode();
    consola.log(`opencode is listening on port ${opencode.port}`);
    await Promise.race([
      new Promise<void>((resolve) => {
        process.once("SIGINT", () => resolve());
        process.once("SIGTERM", () => resolve());
      }),
      opencode.exited,
    ]);
  },
});
