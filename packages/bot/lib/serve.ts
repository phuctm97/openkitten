import { autoRetry } from "@grammyjs/auto-retry";
import { defineCommand } from "citty";
import { Bot } from "grammy";
import { Database } from "~/lib/database";
import { ExistingSessions } from "~/lib/existing-sessions";
import { FloatingPromises } from "~/lib/floating-promises";
import { Grammy } from "~/lib/grammy";
import { GrammyEventStream } from "~/lib/grammy-event-stream";
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
  args: {
    yes: {
      type: "boolean",
      alias: ["y"],
      description: "Skip optional config actions.",
    },
  },
  run: async ({ args: { yes } }) => {
    const profile = await Profile.create();
    const telegramConfig = await TelegramConfig.create(profile, { yes });
    const opencodeConfig = await OpencodeConfig.create(profile, { yes });
    const bot = new Bot(telegramConfig.botToken);
    bot.api.config.use(autoRetry());
    bot.use(grammyFilterUser(telegramConfig.userId));
    using shutdown = Shutdown.create();
    using database = Database.create(profile);
    await using opencodeServer = await OpencodeServer.create(opencodeConfig);
    const existingSessions = await ExistingSessions.create(
      bot,
      database,
      opencodeServer.client,
    );
    using mcpServer = await McpServer.create(
      bot,
      opencodeServer.client,
      existingSessions,
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
    await using floatingPromises = FloatingPromises.create();
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
      (event, signal) => opencodeHandleEvent(scope, event, signal),
    );
    await using grammyEventStream = GrammyEventStream.create(floatingPromises);
    bot.command("start", grammyEventStream.connect(scope, grammyHandleStart));
    bot.command("abort", grammyEventStream.connect(scope, grammyHandleAbort));
    bot.command(
      "compact",
      grammyEventStream.connect(scope, grammyHandleCompact),
    );
    bot.command("agent", grammyEventStream.connect(scope, grammyHandleAgent));
    bot.on(
      "callback_query:data",
      grammyEventStream.connect(scope, grammyHandleCallback),
    );
    bot.on("message:text", grammyEventStream.connect(scope, grammyHandleText));
    bot.on(
      "message:photo",
      grammyEventStream.connect(scope, grammyHandlePhoto),
    );
    await using grammy = await Grammy.create(shutdown, bot);
    // Shut down when: OS signal received, OpenCode server exits,
    // OpenCode event stream ends, MCP server disconnects, or Telegram polling stops.
    await Promise.race([
      shutdown.signaled,
      opencodeServer.exited,
      mcpServer.disconnected,
      opencodeEventStream.closed,
      grammyEventStream.closed,
      grammy.stopped,
    ]);
  },
});
