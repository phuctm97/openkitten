import { createOpencodeClient } from "@opencode-ai/sdk/v2/client";
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
      yield* Effect.logInfo("Bot service is starting");
      const redactedToken = yield* Config.redacted("TELEGRAM_BOT_TOKEN");
      const userId = yield* Config.integer("TELEGRAM_USER_ID");
      const opencodeServer = yield* OpenCode;
      const opencodeClient = createOpencodeClient({
        baseUrl: `http://127.0.0.1:${opencodeServer.port}`,
      });
      const database = yield* Database;
      const runtime = yield* Effect.runtime<Database>();
      const grammyBot = new GrammyBot(Redacted.value(redactedToken));
      grammyBot.catch(({ error, ctx }) =>
        Runtime.runPromise(runtime)(
          Effect.gen(function* () {
            yield* Effect.logError(error);
            yield* Effect.promise(() =>
              ctx.reply("Something went wrong."),
            ).pipe(Effect.ignore);
          }),
        ),
      );
      grammyBot.on("message:text", (ctx) => {
        if (ctx.from?.id !== userId) return;
        return Runtime.runPromise(runtime)(
          Effect.gen(function* () {
            const profile = yield* database.profile.findById("default");
            let sessionId: string;
            if (
              Option.isSome(profile) &&
              Option.isSome(profile.value.activeSessionId)
            ) {
              sessionId = profile.value.activeSessionId.value;
            } else {
              const result = yield* Effect.promise(() =>
                opencodeClient.session.create({}),
              );
              if (!result.data)
                return yield* Effect.die("Failed to create session");
              sessionId = result.data.id;
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
              opencodeClient.session.prompt({
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
            if (replyText) yield* Effect.promise(() => ctx.reply(replyText));
          }),
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
            yield* Effect.logInfo("Bot service is stopping");
            yield* Effect.promise(() => grammyBot.stop()).pipe(Effect.ignore);
            yield* Effect.logInfo("Bot service has stopped");
          }),
      );
      yield* Deferred.await(ready);
      yield* Effect.logInfo("Bot service is ready");
      return Bot.of({ fiber });
    }),
  );
}
