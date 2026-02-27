import { defineCommand } from "citty";
import { Bot } from "grammy";
import { Auth } from "~/lib/auth";
import { bootstrapOpencode } from "~/lib/bootstrap-opencode";
import { Database } from "~/lib/database";
import { Errors } from "~/lib/errors";
import { ExistingSessions } from "~/lib/existing-sessions";
import { FloatingPromises } from "~/lib/floating-promises";
import { Grammy } from "~/lib/grammy";
import { grammyCreateHandler } from "~/lib/grammy-create-handler";
import { grammyFilterUser } from "~/lib/grammy-filter-user";
import { grammyHandleText } from "~/lib/grammy-handle-text";
import { opencodeCreateHandler } from "~/lib/opencode-create-handler";
import { OpencodeEventStream } from "~/lib/opencode-event-stream";
import { opencodeHandleEvent } from "~/lib/opencode-handle-event";
import { OpencodeServer } from "~/lib/opencode-server";
import { PendingPrompts } from "~/lib/pending-prompts";
import { ProcessingMessages } from "~/lib/processing-messages";
import { Profile } from "~/lib/profile";
import type { Scope } from "~/lib/scope";
import { Shutdown } from "~/lib/shutdown";
import { TypingIndicators } from "~/lib/typing-indicators";
import { WorkingSessions } from "~/lib/working-sessions";

export const serve = defineCommand({
  meta: { description: "Start the OpenKitten server." },
  run: async () => {
    using shutdown = Shutdown.create();
    const profile = await Profile.create(Bun.env["OPENKITTEN_PROFILE"]);
    await bootstrapOpencode(profile.opencode);
    const auth = await Auth.load(profile.auth);
    const bot = new Bot(auth.telegram.botToken);
    bot.use(grammyFilterUser(auth.telegram.userId));
    using database = Database.create(profile.database);
    await using opencodeServer = await OpencodeServer.create(profile);
    await using floatingPromises = FloatingPromises.create();
    const existingSessions = ExistingSessions.create(
      bot,
      database,
      opencodeServer.client,
    );
    using workingSessions = WorkingSessions.create(bot, existingSessions);
    await using pendingPrompts = PendingPrompts.create(
      shutdown,
      bot,
      opencodeServer.client,
      existingSessions,
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
        const [{ data: statuses }, { data: questions }, { data: permissions }] =
          await Promise.all([
            opencodeServer.client.session.status({}, { throwOnError: true }),
            opencodeServer.client.question.list({}, { throwOnError: true }),
            opencodeServer.client.permission.list({}, { throwOnError: true }),
          ]);
        await existingSessions.invalidate();
        const results = await Promise.allSettled([
          workingSessions.invalidate(statuses),
          pendingPrompts.invalidate(questions, permissions),
          processingMessages.invalidate(),
        ]);
        Errors.throwIfAny(results);
        await typingIndicators.invalidate();
      },
      opencodeCreateHandler(scope, opencodeHandleEvent),
    );
    bot.on("message:text", grammyCreateHandler(scope, grammyHandleText));
    await using grammy = await Grammy.create(shutdown, bot);
    // Shut down when: OS signal received, OpenCode server exits,
    // event stream exhausts reconnects, or Telegram polling stops.
    await Promise.race([
      shutdown.signaled,
      opencodeServer.exited,
      opencodeEventStream.closed,
      grammy.stopped,
    ]);
  },
});
