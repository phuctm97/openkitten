import { defineCommand } from "citty";
import { createExitHook } from "~/lib/create-exit-hook";
import { createGrammy } from "~/lib/create-grammy";
import { createOpencodeProcess } from "~/lib/create-opencode-process";

export const serve = defineCommand({
  meta: { description: "Start the OpenKitten server." },
  run: async () => {
    using exitHook = createExitHook();
    await using opencodeProcess = await createOpencodeProcess();
    await using grammy = await createGrammy();
    await Promise.race([
      exitHook.exited,
      opencodeProcess.exited,
      grammy.stopped,
    ]);
  },
});
