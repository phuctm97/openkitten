import type { Context } from "grammy";
import type { GrammyEventStream } from "~/lib/grammy-event-stream";
import type { Scope } from "~/lib/scope";

export function grammyCreateHandler<C extends Context>(
  scope: Scope,
  grammyEventStream: GrammyEventStream,
  fn: (scope: Scope, ctx: C) => Promise<void>,
): (ctx: C) => void {
  return (ctx) => {
    void grammyEventStream.enqueue(ctx, () => fn(scope, ctx));
  };
}
