import { defineCommand } from "citty";
import { createExit } from "~/lib/create-exit";
import { createGrammy } from "~/lib/create-grammy";
import { createOpencode } from "~/lib/create-opencode";

export const serve = defineCommand({
  meta: { description: "Start the OpenKitten server." },
  run: async () => {
    using exit = createExit();
    await using opencode = await createOpencode();
    await using grammy = await createGrammy();
    await Promise.race([exit.exited, opencode.exited, grammy.stopped]);
  },
});
