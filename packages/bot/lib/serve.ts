import { autoRetry } from "@grammyjs/auto-retry";
import { defineCommand } from "citty";
import { Bot } from "grammy";
import { Database } from "~/lib/database";
import { ExistingSessions } from "~/lib/existing-sessions";
import { FloatingPromises } from "~/lib/floating-promises";
import { Grammy } from "~/lib/grammy";
import { grammyCreateHandler } from "~/lib/grammy-create-handler";
import { grammyFilterUser } from "~/lib/grammy-filter-user";
import { grammyHandleAbort } from "~/lib/grammy-handle-abort";
import { grammyHandleAgent } from "~/lib/grammy-handle-agent";
import { grammyHandleCallback } from "~/lib/grammy-handle-callback";
import { grammyHandleCompact } from "~/lib/grammy-handle-compact";
import { grammyHandlePhoto } from "~/lib/grammy-handle-photo";
import { grammyHandleStart } from "~/lib/grammy-handle-start";
import { grammyHandleText } from "~/lib/grammy-handle-text";
import { McpServer } from "~/lib/mcp-server";
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
    bot.api.config.use(autoRetry());
    bot.use(grammyFilterUser(telegramConfig.userId));
    using shutdown = Shutdown.create();
    using database = Database.create(profile);
    await using opencodeServer = await OpencodeServer.create(opencodeConfig);
    using mcpServer = await McpServer.create(opencodeServer.client);
    await using floatingPromises = FloatingPromises.create();
    const existingSessions = await ExistingSessions.create(
      bot,
      database,
      opencodeServer.client,
    );
    using workingSessions = WorkingSessions.create(existingSessions);
    await using pendingPrompts = PendingPrompts.create(
      shutdown,
      bot,
      opencodeServer.client,
      existingSessions,
    );
    using processingMessages = await ProcessingMessages.create(
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
      opencodeCreateHandler(scope, opencodeHandleEvent),
    );
    bot.command("start", grammyCreateHandler(scope, grammyHandleStart));
    bot.command("abort", grammyCreateHandler(scope, grammyHandleAbort));
    bot.command("compact", grammyCreateHandler(scope, grammyHandleCompact));
    bot.command("agent", grammyCreateHandler(scope, grammyHandleAgent));
    bot.on(
      "callback_query:data",
      grammyCreateHandler(scope, grammyHandleCallback),
    );
    bot.on("message:text", grammyCreateHandler(scope, grammyHandleText));
    bot.on("message:photo", grammyCreateHandler(scope, grammyHandlePhoto));
    await using grammy = await Grammy.create(shutdown, bot);
    // Shut down when: OS signal received, OpenCode server exits,
    // OpenCode event stream ends, MCP server disconnects, or Telegram polling stops.
    await Promise.race([
      shutdown.signaled,
      opencodeServer.exited,
      mcpServer.disconnected,
      opencodeEventStream.closed,
      grammy.stopped,
    ]);
  },
});
