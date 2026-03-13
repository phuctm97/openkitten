import { defineCommand } from "citty";
import { Bot } from "grammy";
import { createExit } from "~/lib/create-exit";
import { grammyStart } from "~/lib/grammy-start";
import { opencodeServe } from "~/lib/opencode-serve";

export const serve = defineCommand({
  meta: { description: "Start the OpenKitten server." },
  run: async () => {
    using exit = createExit();
    const token = Bun.env["TELEGRAM_BOT_TOKEN"];
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");
    const bot = new Bot(token);
    await using opencode = await opencodeServe();
    await using grammy = await grammyStart(bot);
    await Promise.race([exit.exited, opencode.exited, grammy.stopped]);
  },
});
