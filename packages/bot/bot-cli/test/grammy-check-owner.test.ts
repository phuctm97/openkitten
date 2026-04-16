import { expect, test } from "vitest";
import { grammyCheckOwner } from "~/lib/grammy-check-owner";

test("returns true when ctx.from.id matches ownerId", () => {
  const ctx = { from: { id: 123 } } as never;
  expect(grammyCheckOwner(ctx, 123)).toBe(true);
});

test("returns false when ctx.from.id does not match ownerId", () => {
  const ctx = { from: { id: 456 } } as never;
  expect(grammyCheckOwner(ctx, 123)).toBe(false);
});

test("returns false when ctx.from is undefined", () => {
  const ctx = { from: undefined } as never;
  expect(grammyCheckOwner(ctx, 123)).toBe(false);
});
