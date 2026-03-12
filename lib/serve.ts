import { defineCommand } from "citty";
import { consola } from "consola";
import exitHook from "exit-hook";
import { createOpenCode } from "~/lib/create-opencode";

export const serve = defineCommand({
  meta: { description: "Start the OpenKitten server." },
  run: async () => {
    await using opencode = await createOpenCode();
    consola.log(`opencode is listening on port ${opencode.port}`);
    await new Promise<void>((resolve) => {
      exitHook(() => resolve());
    });
  },
});
