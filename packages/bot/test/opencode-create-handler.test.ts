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

test("fires fn and returns a promise", async () => {
  const fn = vi.fn(async () => {});
  const scope = mockScope();
  const handler = opencodeCreateHandler(scope, fn);
  const result = handler(
    {
      directory: "/tmp/a",
      payload: { type: "session.status", properties: {} },
    } as never,
    new AbortController().signal,
  );
  await expect(result).resolves.toBeUndefined();
  expect(fn).toHaveBeenCalledWith(
    scope,
    {
      directory: "/tmp/a",
      payload: { type: "session.status", properties: {} },
    },
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
  await expect(
    handler(
      {
        directory: "/tmp/a",
        payload: { type: "session.status", properties: {} },
      } as never,
      new AbortController().signal,
    ),
  ).rejects.toBe(error);
  expect(logger.fatal).toHaveBeenCalledWith(
    "Failed to process event from OpenCode",
    error,
    {
      event: {
        directory: "/tmp/a",
        payload: { type: "session.status", properties: {} },
      },
    },
  );
  expect(scope.shutdown.trigger).toHaveBeenCalledOnce();
});
