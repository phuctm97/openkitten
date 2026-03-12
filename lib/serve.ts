import { defineCommand } from "citty";
import { consola } from "consola";
import { startOpenCode } from "~/lib/start-opencode";

export default defineCommand({
  meta: { description: "Start the OpenKitten server." },
  run: async () => {
    await using opencode = await startOpenCode();
    consola.log(`opencode is listening on port ${opencode.port}`);
    await opencode.exited;
  },
});
