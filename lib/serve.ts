import { defineCommand } from "citty";
import { createExitHook } from "~/lib/create-exit-hook";
import { createGrammy } from "~/lib/create-grammy";
import { createOpencode } from "~/lib/create-opencode";

export const serve = defineCommand({
  meta: { description: "Start the OpenKitten server." },
  run: async () => {
    using exitHook = createExitHook();
    await using opencode = await createOpencode();
    await using grammy = await createGrammy();
    await Promise.race([exitHook.exited, opencode.exited, grammy.stopped]);
  },
});
