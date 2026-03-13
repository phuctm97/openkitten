import { defineCommand } from "citty";
import { Bot } from "grammy";
import { createDatabase } from "~/lib/create-database";
import { createPendingPrompts } from "~/lib/create-pending-prompts";
import { createTypingIndicators } from "~/lib/create-typing-indicators";
import { grammyStart } from "~/lib/grammy-start";
import { invalidateSessions } from "~/lib/invalidate-sessions";
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
    using pendingPrompts = createPendingPrompts(bot, opencodeServer.client);
    await using opencodeEventStream = opencodeStream(
      opencodeServer.client,
      async () => {
        const { reachable } = await invalidateSessions(bot, database);
        const reachableSessionIds = new Set(reachable.map((s) => s.id));
        const staleTypingIndicatorSessionIds =
          typingIndicators.sessionIds.filter(
            (id) => !reachableSessionIds.has(id),
          );
        typingIndicators.stop(...staleTypingIndicatorSessionIds);
        await typingIndicators.invalidate(...reachable);
        const stalePendingPromptSessionIds = pendingPrompts.sessionIds.filter(
          (id) => !reachableSessionIds.has(id),
        );
        pendingPrompts.dismiss(...stalePendingPromptSessionIds);
        await pendingPrompts.invalidate(...reachable);
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
