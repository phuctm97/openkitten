import type { Context } from "grammy";

export function grammyCheckOwner(ctx: Context, ownerId: number): boolean {
  return ctx.from?.id === ownerId;
}
