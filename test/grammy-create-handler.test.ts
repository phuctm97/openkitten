import { expect, test, vi } from "vitest";
import { FloatingPromises } from "~/lib/floating-promises";
import { grammyCreateHandler } from "~/lib/grammy-create-handler";
import { logger } from "~/lib/logger";
import type { Scope } from "~/lib/scope";

function mockScope(): Scope {
  return {
    floatingPromises: FloatingPromises.create(),
    shutdown: { trigger: vi.fn() },
  } as never;
}

function mockCtx(updateId = 1) {
  return { update: { update_id: updateId } } as never;
}

test("calls fn with scope and ctx", () => {
  const scope = mockScope();
  const fn = vi.fn().mockResolvedValue(undefined);
  const handler = grammyCreateHandler(scope, fn);
  const ctx = mockCtx();

  handler(ctx);

  expect(fn).toHaveBeenCalledWith(scope, ctx);
});

test("logs fatal and triggers shutdown when fn rejects", async () => {
  const scope = mockScope();
  const error = new Error("handler failed");
  const fn = vi.fn().mockRejectedValue(error);
  const handler = grammyCreateHandler(scope, fn);

  handler(mockCtx(42));

  await vi.waitFor(() =>
    expect(logger.fatal).toHaveBeenCalledWith(
      "Failed to process update from Telegram",
      error,
      { update: { update_id: 42 } },
    ),
  );
  expect(scope.shutdown.trigger).toHaveBeenCalledOnce();
});
