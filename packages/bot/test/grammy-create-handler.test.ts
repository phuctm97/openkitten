import { expect, test, vi } from "vitest";
import { grammyCreateHandler } from "~/lib/grammy-create-handler";
import type { Scope } from "~/lib/scope";

function mockScope(): Scope {
  return {
    floatingPromises: {} as never,
    shutdown: {} as never,
  } as never;
}

function mockCtx(updateId = 1) {
  return { update: { update_id: updateId } } as never;
}

function mockGrammyEventStream() {
  return { enqueue: vi.fn() };
}

test("enqueues fn with scope and ctx", async () => {
  const scope = mockScope();
  const grammyEventStream = mockGrammyEventStream();
  const fn = vi.fn().mockResolvedValue(undefined);
  const handler = grammyCreateHandler(scope, grammyEventStream as never, fn);
  const ctx = mockCtx();

  handler(ctx);

  expect(grammyEventStream.enqueue).toHaveBeenCalledWith(
    ctx,
    expect.any(Function),
  );
  const call = grammyEventStream.enqueue.mock.calls[0];
  expect(call).toBeDefined();
  if (!call) return;
  const [, onEvent] = call;
  await onEvent();
  expect(fn).toHaveBeenCalledWith(scope, ctx);
});
