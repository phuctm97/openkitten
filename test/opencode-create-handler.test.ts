import { expect, test, vi } from "vitest";
import { FloatingPromises } from "~/lib/floating-promises";
import { logger } from "~/lib/logger";
import { opencodeCreateHandler } from "~/lib/opencode-create-handler";
import type { Scope } from "~/lib/scope";

function mockScope(): Scope {
  return {
    floatingPromises: FloatingPromises.create(),
    shutdown: { trigger: vi.fn() },
  } as never;
}

test("fires fn and does not return a promise", () => {
  const fn = vi.fn(async () => {});
  const scope = mockScope();
  const handler = opencodeCreateHandler(scope, fn);
  const result = handler(
    { type: "session.status", properties: {} } as never,
    new AbortController().signal,
  );
  expect(result).toBeUndefined();
  expect(fn).toHaveBeenCalledWith(
    scope,
    { type: "session.status", properties: {} },
    expect.any(AbortSignal),
  );
});

test("logs fatal and triggers shutdown when fn rejects", async () => {
  const error = new Error("handler failed");
  const fn = vi.fn(async () => {
    throw error;
  });
  const scope = mockScope();
  const handler = opencodeCreateHandler(scope, fn);
  handler(
    { type: "session.status", properties: {} } as never,
    new AbortController().signal,
  );
  await vi.waitFor(() =>
    expect(logger.fatal).toHaveBeenCalledWith(
      "Failed to process event from OpenCode",
      error,
      { event: { type: "session.status", properties: {} } },
    ),
  );
  expect(scope.shutdown.trigger).toHaveBeenCalledOnce();
});
