import { createOpencodeClient } from "@opencode-ai/sdk/v2/client";
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
        () =>
          Effect.gen(function* () {
            yield* Effect.logInfo("Bot service is stopping");
            yield* Effect.promise(() => grammyBot.stop()).pipe(Effect.ignore);
            yield* Effect.logInfo("Bot service has stopped");
          }),
      );
      yield* Deferred.await(ready);
      yield* Effect.logInfo("Bot service is ready");
      const opencodeServer = yield* OpenCode;
      const opencodeClient = createOpencodeClient({
        baseUrl: `http://127.0.0.1:${opencodeServer.port}`,
      });
      yield* Effect.promise(() => opencodeClient.session.list());
      yield* Effect.logInfo("OpenCode client is connected");
      return Bot.of({ fiber });
    }),
  );
}
