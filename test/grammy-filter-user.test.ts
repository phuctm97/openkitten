import { consola } from "consola";
import { expect, test, vi } from "vitest";
import { grammyFilterUser } from "~/lib/grammy-filter-user";

test("calls next for matching user", async () => {
  const filter = grammyFilterUser(123);
  const next = vi.fn();
  const ctx = { from: { id: 123 }, update: { update_id: 1 } } as never;

  await filter(ctx, next);

  expect(next).toHaveBeenCalledOnce();
  expect(consola.warn).not.toHaveBeenCalled();
});

test("skips and warns for non-matching user", () => {
  const filter = grammyFilterUser(123);
  const next = vi.fn();
  const ctx = { from: { id: 456 }, update: { update_id: 2 } } as never;

  filter(ctx, next);

  expect(next).not.toHaveBeenCalled();
  expect(consola.warn).toHaveBeenCalledWith(
    "grammY received an update from unauthorized user",
    { userId: 456, updateId: 2 },
  );
});

test("skips and warns when from is undefined", () => {
  const filter = grammyFilterUser(123);
  const next = vi.fn();
  const ctx = { from: undefined, update: { update_id: 3 } } as never;

  filter(ctx, next);

  expect(next).not.toHaveBeenCalled();
  expect(consola.warn).toHaveBeenCalledWith(
    "grammY received an update from unauthorized user",
    { userId: undefined, updateId: 3 },
  );
});
