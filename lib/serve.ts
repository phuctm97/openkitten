import { defineCommand } from "citty";
import { Bot } from "grammy";
import { createExit } from "~/lib/create-exit";
import { createOpencode } from "~/lib/create-opencode";
import { startGrammy } from "~/lib/start-grammy";

export const serve = defineCommand({
  meta: { description: "Start the OpenKitten server." },
  run: async () => {
    const token = Bun.env["TELEGRAM_BOT_TOKEN"];
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");
    const bot = new Bot(token);

    using exit = createExit();
    await using opencode = await createOpencode();
    await using grammy = await startGrammy(bot);
    await Promise.race([exit.exited, opencode.exited, grammy.stopped]);
  },
});
