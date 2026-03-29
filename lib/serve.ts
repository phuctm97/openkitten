import { defineCommand } from "citty";
import { Bot } from "grammy";
import { Database } from "~/lib/database";
import { Errors } from "~/lib/errors";
import { ExistingSessions } from "~/lib/existing-sessions";
import { FloatingPromises } from "~/lib/floating-promises";
import { Grammy } from "~/lib/grammy";
import { grammyCreateHandler } from "~/lib/grammy-create-handler";
import { grammyFilterUser } from "~/lib/grammy-filter-user";
import { grammyHandleAbort } from "~/lib/grammy-handle-abort";
import { grammyHandleCallback } from "~/lib/grammy-handle-callback";
import { grammyHandleCompact } from "~/lib/grammy-handle-compact";
import { grammyHandleStart } from "~/lib/grammy-handle-start";
import { grammyHandleText } from "~/lib/grammy-handle-text";
import { McpServer } from "~/lib/mcp-server";
import { NestingSessions } from "~/lib/nesting-sessions";
import { OpencodeConfig } from "~/lib/opencode-config";
import { opencodeCreateHandler } from "~/lib/opencode-create-handler";
import { OpencodeEventStream } from "~/lib/opencode-event-stream";
import { opencodeHandleEvent } from "~/lib/opencode-handle-event";
import { OpencodeServer } from "~/lib/opencode-server";
import { PendingPrompts } from "~/lib/pending-prompts";
import { ProcessingMessages } from "~/lib/processing-messages";
import { Profile } from "~/lib/profile";
import type { Scope } from "~/lib/scope";
import { Shutdown } from "~/lib/shutdown";
import { TelegramConfig } from "~/lib/telegram-config";
import { TypingIndicators } from "~/lib/typing-indicators";
import { WorkingSessions } from "~/lib/working-sessions";

export const serve = defineCommand({
  meta: { description: "Start the OpenKitten server." },
  run: async () => {
    const profile = await Profile.create();
    const telegramConfig = await TelegramConfig.create(profile);
    const opencodeConfig = await OpencodeConfig.create(profile);
    const bot = new Bot(telegramConfig.botToken);
    bot.use(grammyFilterUser(telegramConfig.userId));
    using shutdown = Shutdown.create();
    using database = Database.create(profile);
    await using opencodeServer = await OpencodeServer.create(opencodeConfig);
    using mcpServer = await McpServer.create(opencodeServer.client);
    await using floatingPromises = FloatingPromises.create();
    const existingSessions = ExistingSessions.create(
      bot,
      database,
      opencodeServer.client,
    );
    const nestingSessions = NestingSessions.create(opencodeServer.client);
    using workingSessions = WorkingSessions.create(
      opencodeServer.client,
      existingSessions,
    );
    await using pendingPrompts = PendingPrompts.create(
      shutdown,
      bot,
      opencodeServer.client,
      existingSessions,
      nestingSessions,
    );
    const processingMessages = ProcessingMessages.create(
      bot,
      database,
      opencodeServer.client,
      existingSessions,
    );
    using typingIndicators = TypingIndicators.create(
      shutdown,
      bot,
      existingSessions,
      workingSessions,
      pendingPrompts,
      floatingPromises,
    );
    const scope: Scope = {
      shutdown,
      bot,
      database,
      opencodeClient: opencodeServer.client,
      floatingPromises,
      existingSessions,
      workingSessions,
      pendingPrompts,
      processingMessages,
      typingIndicators,
    };
    await using opencodeEventStream = OpencodeEventStream.create(
      opencodeServer.client,
      floatingPromises,
      // On (re)connect: fetch full server state and sync all local managers.
      async (_signal) => {
        await existingSessions.invalidate();
        const firstResults = await Promise.allSettled([
          workingSessions.invalidate(),
          pendingPrompts.invalidate(),
        ]);
        Errors.throwIfAny(firstResults);
        const secondResults = await Promise.allSettled([
          processingMessages.invalidate(),
          typingIndicators.invalidate(),
        ]);
        Errors.throwIfAny(secondResults);
      },
      opencodeCreateHandler(scope, opencodeHandleEvent),
    );
    bot.command("start", grammyCreateHandler(scope, grammyHandleStart));
    bot.command("abort", grammyCreateHandler(scope, grammyHandleAbort));
    bot.command("compact", grammyCreateHandler(scope, grammyHandleCompact));
    bot.on(
      "callback_query:data",
      grammyCreateHandler(scope, grammyHandleCallback),
    );
    bot.on("message:text", grammyCreateHandler(scope, grammyHandleText));
    await using grammy = await Grammy.create(shutdown, bot);
    // Shut down when: OS signal received, OpenCode server exits,
    // MCP server disconnects, event stream exhausts reconnects, or Telegram polling stops.
    await Promise.race([
      shutdown.signaled,
      opencodeServer.exited,
      mcpServer.disconnected,
      opencodeEventStream.closed,
      grammy.stopped,
    ]);
  },
});
