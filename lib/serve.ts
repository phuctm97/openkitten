import { defineCommand } from "citty";
import { consola } from "consola";
import { startOpenCode } from "~/lib/start-opencode";

export const serve = defineCommand({
  meta: { description: "Start the OpenKitten server." },
  run: async () => {
    await using opencode = await startOpenCode();
    consola.log(`opencode is listening on port ${opencode.port}`);
    await opencode.exited;
  },
});
