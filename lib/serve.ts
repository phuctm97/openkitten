import { defineCommand } from "citty";
import { createBot } from "~/lib/create-bot";
import { createExitHook } from "~/lib/create-exit-hook";
import { createOpencodeProcess } from "~/lib/create-opencode-process";

export const serve = defineCommand({
  meta: { description: "Start the OpenKitten server." },
  run: async () => {
    using exitHook = createExitHook();
    await using opencodeProcess = await createOpencodeProcess();
    await using bot = await createBot();
    await Promise.race([exitHook.exited, opencodeProcess.exited, bot.stopped]);
  },
});
