import { defineCommand } from "citty";
import { consola } from "consola";
import { createExitSignal } from "~/lib/create-exit-signal";
import { createOpenCode } from "~/lib/create-opencode";

export const serve = defineCommand({
  meta: { description: "Start the OpenKitten server." },
  run: async () => {
    using exitSignal = createExitSignal();
    await using opencode = await createOpenCode();
    consola.log(`opencode is listening on port ${opencode.port}`);
    await Promise.race([exitSignal.exited, opencode.exited]);
  },
});
