import { Config, Context, Effect, type Fiber, Layer, Redacted } from "effect";
import { Bot as GrammyBot } from "grammy";
import pkg from "~/package.json" with { type: "json" };

export class Bot extends Context.Tag(`${pkg.name}/Bot`)<
  Bot,
  { readonly fiber: Fiber.RuntimeFiber<void> }
>() {
  static readonly layer = Layer.scoped(
    Bot,
    Effect.gen(function* () {
      const redactedToken = yield* Config.redacted("TELEGRAM_BOT_TOKEN");
      const userId = yield* Config.integer("TELEGRAM_USER_ID");
      const grammyBot = new GrammyBot(Redacted.value(redactedToken));
      grammyBot.on("message:text", (ctx) => {
        if (ctx.from?.id === userId)
          return ctx.reply(`[${pkg.name}] ${ctx.message.text}`);
      });
      const fiber = yield* Effect.acquireRelease(
        Effect.async<void>((resume) => {
          grammyBot.start().then(
            () => resume(Effect.void),
            (error) => resume(Effect.die(error)),
          );
        }).pipe(Effect.forkScoped),
        () => Effect.promise(() => grammyBot.stop()).pipe(Effect.ignore),
      );
      return Bot.of({ fiber });
    }),
  );
}
