import { defineCommand } from "citty";
import { Bot } from "grammy";
import { createDatabase } from "~/lib/create-database";
import { createTypingIndicators } from "~/lib/create-typing-indicators";
import { grammyStart } from "~/lib/grammy-start";
import { opencodeServe } from "~/lib/opencode-serve";
import { opencodeStream } from "~/lib/opencode-stream";
import { shutdownListen } from "~/lib/shutdown-listen";

export const serve = defineCommand({
  meta: { description: "Start the OpenKitten server." },
  run: async () => {
    using shutdown = shutdownListen();
    const token = Bun.env["TELEGRAM_BOT_TOKEN"];
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");
    const bot = new Bot(token);
    using database = createDatabase("openkitten.db");
    await using opencodeServer = await opencodeServe();
    using typingIndicators = createTypingIndicators(bot, opencodeServer.client);
    await using opencodeEventStream = opencodeStream(
      opencodeServer.client,
      async () => {
        const sessions = await database.query.session.findMany();
        await typingIndicators.invalidate(...sessions);
      },
      () => {},
    );
    await using grammy = await grammyStart(bot);
    await Promise.race([
      shutdown.signaled,
      opencodeServer.exited,
      opencodeEventStream.ended,
      grammy.stopped,
    ]);
  },
});
