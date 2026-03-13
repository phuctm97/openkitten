import { defineCommand } from "citty";
import { Bot } from "grammy";
import { grammyStart } from "~/lib/grammy-start";
import { opencodeServe } from "~/lib/opencode-serve";
import { shutdownListen } from "~/lib/shutdown-listen";

export const serve = defineCommand({
  meta: { description: "Start the OpenKitten server." },
  run: async () => {
    using shutdown = shutdownListen();
    const token = Bun.env["TELEGRAM_BOT_TOKEN"];
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");
    const bot = new Bot(token);
    await using opencode = await opencodeServe();
    await using grammy = await grammyStart(bot);
    await Promise.race([shutdown.signaled, opencode.exited, grammy.stopped]);
  },
});
