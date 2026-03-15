import { expect, test, vi } from "vitest";
import { grammyFilterUser } from "~/lib/grammy-filter-user";

test("calls next for matching user", async () => {
  const filter = grammyFilterUser(123);
  const next = vi.fn();
  const ctx = { from: { id: 123 } } as never;

  await filter(ctx, next);

  expect(next).toHaveBeenCalledOnce();
});

test("skips next for non-matching user", () => {
  const filter = grammyFilterUser(123);
  const next = vi.fn();
  const ctx = { from: { id: 456 } } as never;

  filter(ctx, next);

  expect(next).not.toHaveBeenCalled();
});

test("skips next when from is undefined", () => {
  const filter = grammyFilterUser(123);
  const next = vi.fn();
  const ctx = { from: undefined } as never;

  filter(ctx, next);

  expect(next).not.toHaveBeenCalled();
});
