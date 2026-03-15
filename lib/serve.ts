import { defineCommand } from "citty";
import { consola } from "consola";
import { Bot } from "grammy";
import { createDatabase } from "~/lib/create-database";
import { createPendingPrompts } from "~/lib/create-pending-prompts";
import { createTypingIndicators } from "~/lib/create-typing-indicators";
import { grammyCreateHandler } from "~/lib/grammy-create-handler";
import { grammyFilterUser } from "~/lib/grammy-filter-user";
import { grammyHandleText } from "~/lib/grammy-handle-text";
import { grammyStart } from "~/lib/grammy-start";
import { invalidateSessions } from "~/lib/invalidate-sessions";
import { opencodeServe } from "~/lib/opencode-serve";
import type { OpencodeSnapshot } from "~/lib/opencode-snapshot";
import { opencodeStream } from "~/lib/opencode-stream";
import { shutdownListen } from "~/lib/shutdown-listen";

export const serve = defineCommand({
  meta: { description: "Start the OpenKitten server." },
  run: async () => {
    consola.start("OpenKitten is starting…");
    using shutdown = shutdownListen();
    const token = Bun.env["TELEGRAM_BOT_TOKEN"];
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");
    const rawUserId = Bun.env["TELEGRAM_USER_ID"];
    if (!rawUserId) throw new Error("TELEGRAM_USER_ID is required");
    const userId = Number(rawUserId);
    if (!Number.isInteger(userId) || userId <= 0)
      throw new Error(`TELEGRAM_USER_ID is invalid: "${rawUserId}"`);
    const bot = new Bot(token);
    bot.use(grammyFilterUser(userId));
    using database = createDatabase(":memory:");
    await using opencodeServer = await opencodeServe();
    using typingIndicators = createTypingIndicators(bot);
    await using pendingPrompts = createPendingPrompts(
      bot,
      opencodeServer.client,
    );
    await using opencodeEventStream = opencodeStream(
      opencodeServer.client,
      async () => {
        const [{ data: statuses }, { data: questions }, { data: permissions }] =
          await Promise.all([
            opencodeServer.client.session.status({}, { throwOnError: true }),
            opencodeServer.client.question.list({}, { throwOnError: true }),
            opencodeServer.client.permission.list({}, { throwOnError: true }),
          ]);
        const snapshot: OpencodeSnapshot = { statuses, questions, permissions };
        const { reachable } = await invalidateSessions(bot, database, snapshot);
        const reachableSessionIds = new Set(reachable.map((s) => s.id));
        const staleTypingIndicatorSessionIds =
          typingIndicators.sessionIds.filter(
            (id) => !reachableSessionIds.has(id),
          );
        typingIndicators.stop(...staleTypingIndicatorSessionIds);
        await typingIndicators.invalidate(snapshot, ...reachable);
        const stalePendingPromptSessionIds = pendingPrompts.sessionIds.filter(
          (id) => !reachableSessionIds.has(id),
        );
        await pendingPrompts.dismiss(...stalePendingPromptSessionIds);
        await pendingPrompts.invalidate(snapshot, ...reachable);
        await pendingPrompts.flush(...reachableSessionIds);
      },
      () => {},
    );
    const grammyHandleContext = {
      bot,
      database,
      opencodeClient: opencodeServer.client,
      pendingPrompts,
    };
    bot.on(
      "message:text",
      grammyCreateHandler(grammyHandleContext, grammyHandleText),
    );
    await using grammy = await grammyStart(bot);
    consola.ready("OpenKitten is ready");
    await Promise.race([
      shutdown.signaled,
      opencodeServer.exited,
      opencodeEventStream.ended,
      grammy.stopped,
    ]);
  },
});
