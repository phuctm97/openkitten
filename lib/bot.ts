import {
  Config,
  Context,
  Deferred,
  Effect,
  Exit,
  type Fiber,
  Layer,
  Redacted,
} from "effect";
import { Bot as GrammyBot } from "grammy";
import { annotateTag } from "~/lib/annotate-tag";
import { makeTag } from "~/lib/make-tag";
import pkg from "~/package.json" with { type: "json" };

export class Bot extends Context.Tag(makeTag("Bot"))<
  Bot,
  { readonly fiber: Fiber.RuntimeFiber<void> }
>() {
  static readonly layer = Layer.scoped(
    Bot,
    Effect.gen(function* () {
      yield* Effect.logInfo("Starting");
      const redactedToken = yield* Config.redacted("TELEGRAM_BOT_TOKEN");
      const userId = yield* Config.integer("TELEGRAM_USER_ID");
      const grammyBot = new GrammyBot(Redacted.value(redactedToken));
      grammyBot.on("message:text", (ctx) => {
        if (ctx.from?.id === userId)
          return ctx.reply(`[${pkg.name}] ${ctx.message.text}`);
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
        () => Effect.promise(() => grammyBot.stop()).pipe(Effect.ignore),
      );
      yield* Deferred.await(ready);
      yield* Effect.logInfo("Ready");
      return Bot.of({ fiber });
    }).pipe(annotateTag(Bot)),
  );
}
