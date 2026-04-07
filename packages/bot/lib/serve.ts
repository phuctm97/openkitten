import { autoRetry } from "@grammyjs/auto-retry";
import { defineCommand } from "citty";
import { Bot } from "grammy";
import { AttachmentStorage } from "~/lib/attachment-storage";
import { Database } from "~/lib/database";
import { ExistingSessions } from "~/lib/existing-sessions";
import { FloatingPromises } from "~/lib/floating-promises";
import { GrammyEventLoop } from "~/lib/grammy-event-loop";
import { GrammyEventStream } from "~/lib/grammy-event-stream";
import { grammyFilterUser } from "~/lib/grammy-filter-user";
import { grammyHandleAbort } from "~/lib/grammy-handle-abort";
import { grammyHandleAgent } from "~/lib/grammy-handle-agent";
import { grammyHandleCallback } from "~/lib/grammy-handle-callback";
import { grammyHandleCompact } from "~/lib/grammy-handle-compact";
import { grammyHandleFile } from "~/lib/grammy-handle-file";
import { grammyHandleMediaGroupFlush } from "~/lib/grammy-handle-media-group-flush";
import { grammyHandleStart } from "~/lib/grammy-handle-start";
import { grammyHandleText } from "~/lib/grammy-handle-text";
import { grammySetCommands } from "~/lib/grammy-set-commands";
import { logger } from "~/lib/logger";
import { McpServer } from "~/lib/mcp-server";
import { MediaGroupBuffer } from "~/lib/media-group-buffer";
import { OpencodeConfig } from "~/lib/opencode-config";
import { OpencodeEventStream } from "~/lib/opencode-event-stream";
import { opencodeHandleEvent } from "~/lib/opencode-handle-event";
import { OpencodeServer } from "~/lib/opencode-server";
import { PendingPrompts } from "~/lib/pending-prompts";
import { ProcessingMessages } from "~/lib/processing-messages";
import { Profile } from "~/lib/profile";
import { restart } from "~/lib/restart";
import { Scheduler } from "~/lib/scheduler";
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
  run: ({ args }) =>
    restart(async (attempt) => {
      const profile = await Profile.create();
      const skipActions = args.yes || attempt > 1;
      const telegramConfig = await TelegramConfig.create(profile, {
        skipActions,
      });
      const opencodeConfig = await OpencodeConfig.create(profile, {
        skipActions,
      });
      await grammySetCommands(telegramConfig.botToken);
      const bot = new Bot(telegramConfig.botToken);
      bot.api.config.use(autoRetry());
      bot.use(grammyFilterUser(telegramConfig.userId));
      using database = Database.create(profile);
      using shutdown = Shutdown.create();
      await using opencodeServer = await OpencodeServer.create(opencodeConfig);
      const existingSessions = await ExistingSessions.create(
        bot,
        database,
        opencodeServer.client,
      );
      using scheduler = Scheduler.create(
        bot,
        database,
        opencodeServer.client,
        existingSessions,
        profile.xdgData,
      );
      using mcpServer = await McpServer.create(
        bot,
        opencodeServer.client,
        existingSessions,
        scheduler,
      );
      using workingSessions = WorkingSessions.create(existingSessions);
      await using pendingPrompts = PendingPrompts.create(
        bot,
        shutdown,
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
      using mediaGroupBuffer = MediaGroupBuffer.create(
        floatingPromises,
        async (entries) => {
          try {
            await grammyHandleMediaGroupFlush(
              {
                bot,
                database,
                opencodeClient: opencodeServer.client,
                existingSessions,
                workingSessions,
                pendingPrompts,
              },
              entries,
            );
          } catch (error) {
            logger.fatal("Media group flush failed", error);
            shutdown.trigger();
          }
        },
      );
      using typingIndicators = TypingIndicators.create(
        bot,
        shutdown,
        existingSessions,
        workingSessions,
        pendingPrompts,
        floatingPromises,
      );
      const attachmentStorage = AttachmentStorage.create(profile.xdgCache);
      const scope: Scope = {
        bot,
        database,
        shutdown,
        opencodeClient: opencodeServer.client,
        existingSessions,
        workingSessions,
        pendingPrompts,
        processingMessages,
        floatingPromises,
        mediaGroupBuffer,
        attachmentStorage,
        typingIndicators,
      };
      await using opencodeEventStream = OpencodeEventStream.create(
        opencodeServer.client,
        floatingPromises,
        (event, signal) => opencodeHandleEvent(scope, event, signal),
      );
      await using grammyEventLoop = GrammyEventLoop.create(floatingPromises);
      bot.command("start", grammyEventLoop.connect(scope, grammyHandleStart));
      bot.command("abort", grammyEventLoop.connect(scope, grammyHandleAbort));
      bot.command(
        "compact",
        grammyEventLoop.connect(scope, grammyHandleCompact),
      );
      bot.command("agent", grammyEventLoop.connect(scope, grammyHandleAgent));
      bot.on(
        "callback_query:data",
        grammyEventLoop.connect(scope, grammyHandleCallback),
      );
      bot.on("message:text", grammyEventLoop.connect(scope, grammyHandleText));
      const fileHandler = grammyEventLoop.connect(scope, grammyHandleFile);
      bot.on("message:photo", fileHandler);
      bot.on("message:document", fileHandler);
      bot.on("message:video", fileHandler);
      bot.on("message:audio", fileHandler);
      bot.on("message:voice", fileHandler);
      bot.on("message:animation", fileHandler);
      bot.on("message:video_note", fileHandler);
      bot.on("message:sticker", fileHandler);
      await using grammyEventStream = await GrammyEventStream.create(
        bot,
        shutdown,
      );
      const result = await Promise.race([
        shutdown.signaled,
        opencodeServer.exited,
        mcpServer.exited,
        opencodeEventStream.ended,
        grammyEventLoop.ended,
        grammyEventStream.ended,
      ]);
      return result;
    }),
});
