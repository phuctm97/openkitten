import {
  Config,
  Context,
  Deferred,
  Effect,
  Exit,
  type Fiber,
  Layer,
  Option,
  Redacted,
  Runtime,
} from "effect";
import { Bot as GrammyBot } from "grammy";
import { Database } from "~/lib/database";
import { isTextPart } from "~/lib/is-text-part";
import { OpenCode } from "~/lib/opencode";
import pkg from "~/package.json" with { type: "json" };

export class Bot extends Context.Tag(`${pkg.name}/Bot`)<
  Bot,
  { readonly fiber: Fiber.RuntimeFiber<void> }
>() {
  static readonly layer = Layer.scoped(
    Bot,
    Effect.gen(function* () {
      yield* Effect.logInfo("Bot.service is starting");
      const redactedToken = yield* Config.redacted("TELEGRAM_BOT_TOKEN");
      const userId = yield* Config.integer("TELEGRAM_USER_ID");
      const runtime = yield* Effect.runtime<OpenCode | Database>();
      const grammyBot = new GrammyBot(Redacted.value(redactedToken));
      grammyBot.catch(({ error, ctx }) =>
        Runtime.runPromise(runtime)(
          Effect.gen(function* () {
            yield* Effect.logError(error).pipe(
              Effect.annotateLogs("source", "Bot.service"),
            );
            yield* Effect.promise(() =>
              ctx.reply("Something went wrong."),
            ).pipe(Effect.ignore);
          }).pipe(
            Effect.annotateLogs("chatId", ctx.chat?.id),
            Effect.annotateLogs("messageId", ctx.message?.message_id),
          ),
        ),
      );
      grammyBot.on("message:text", (ctx) => {
        if (ctx.from?.id !== userId) {
          return Runtime.runPromise(runtime)(
            Effect.logWarning(
              "Bot.service ignored a message from an unauthorized user",
            ).pipe(Effect.annotateLogs("userId", ctx.from?.id)),
          );
        }
        return Runtime.runPromise(runtime)(
          Effect.gen(function* () {
            yield* Effect.logInfo("Bot.service received a message");
            const opencode = yield* OpenCode;
            const database = yield* Database;
            const profile = yield* database.profile.findById("default");
            let sessionId: string;
            if (
              Option.isSome(profile) &&
              Option.isSome(profile.value.activeSessionId)
            ) {
              sessionId = profile.value.activeSessionId.value;
              yield* Effect.logDebug(
                "Bot.service reused an existing session",
              ).pipe(Effect.annotateLogs("sessionId", sessionId));
            } else {
              const result = yield* Effect.promise(() =>
                opencode.client.session.create({}),
              );
              if (!result.data)
                return yield* Effect.die("Failed to create session");
              sessionId = result.data.id;
              yield* Effect.logInfo("Bot.service created a new session").pipe(
                Effect.annotateLogs("sessionId", sessionId),
              );
              if (Option.isNone(profile)) {
                yield* database.profile.insert({
                  id: "default",
                  activeSessionId: Option.some(sessionId),
                  createdAt: undefined,
                  updatedAt: undefined,
                });
              } else {
                yield* database.profile.update({
                  id: profile.value.id,
                  activeSessionId: Option.some(sessionId),
                  updatedAt: undefined,
                });
              }
            }
            const result = yield* Effect.promise(() =>
              opencode.client.session.prompt({
                sessionID: sessionId,
                parts: [{ type: "text", text: ctx.message.text }],
              }),
            );
            if (!result.data)
              return yield* Effect.die("Failed to prompt session");
            const replyText = result.data.parts
              .filter(isTextPart)
              .map((p) => p.text)
              .filter(Boolean)
              .join("\n")
              .trim();
            if (replyText) {
              yield* Effect.promise(() => ctx.reply(replyText));
              yield* Effect.logInfo("Bot.service sent a reply");
            } else {
              yield* Effect.logWarning(
                "Bot.service received an empty response",
              );
            }
          }).pipe(
            Effect.annotateLogs("chatId", ctx.chat.id),
            Effect.annotateLogs("messageId", ctx.message?.message_id),
          ),
        );
      });
      const ready = yield* Deferred.make<void>();
      const fiber = yield* Effect.acquireRelease(
        Effect.async<void>((resume) => {
          grammyBot
            .start({ onStart: () => Deferred.unsafeDone(ready, Exit.void) })
            .then(
              () => {
                Deferred.unsafeDone(ready, Exit.void);
                resume(Effect.void);
              },
              (error) => {
                Deferred.unsafeDone(ready, Exit.die(error));
                resume(Effect.die(error));
              },
            );
        }).pipe(Effect.forkScoped),
        () =>
          Effect.gen(function* () {
            yield* Effect.logInfo("Bot.service is stopping");
            yield* Effect.promise(() => grammyBot.stop()).pipe(Effect.ignore);
            yield* Effect.logInfo("Bot.service has stopped");
          }),
      );
      yield* Deferred.await(ready);
      yield* Effect.logInfo("Bot.service is ready");
      return Bot.of({ fiber });
    }),
  );
}
