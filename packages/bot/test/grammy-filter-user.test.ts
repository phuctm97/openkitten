import { expect, test, vi } from "vitest";
import { grammyFilterUser } from "~/lib/grammy-filter-user";
import { logger } from "~/lib/logger";

test("calls next for matching user", async () => {
  const filter = grammyFilterUser(123);
  const next = vi.fn();
  const ctx = { from: { id: 123 }, update: { update_id: 1 } } as never;

  await filter(ctx, next);

  expect(next).toHaveBeenCalledOnce();
  expect(logger.warn).not.toHaveBeenCalled();
});

test("rejects non-matching user", () => {
  const filter = grammyFilterUser(123);
  const next = vi.fn();
  const ctx = { from: { id: 456 }, update: { update_id: 2 } } as never;

  filter(ctx, next);

  expect(next).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledWith(
    "grammY rejected an unauthorized update",
    { update: { update_id: 2 } },
  );
});

test("rejects when from is undefined", () => {
  const filter = grammyFilterUser(123);
  const next = vi.fn();
  const ctx = { from: undefined, update: { update_id: 3 } } as never;

  filter(ctx, next);

  expect(next).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledWith(
    "grammY rejected an unauthorized update",
    { update: { update_id: 3 } },
  );
});
