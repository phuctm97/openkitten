import { expect, test, vi } from "vitest";
import { grammyFilterChat } from "~/lib/grammy-filter-chat";
import { logger } from "~/lib/logger";

function ctx(
  chatType: string | undefined,
  fromId: number | undefined,
  updateId = 1,
) {
  return {
    chat: chatType ? { type: chatType } : undefined,
    from: fromId !== undefined ? { id: fromId } : undefined,
    update: { update_id: updateId },
  } as never;
}

test("calls next for matching user in private chat", async () => {
  const filter = grammyFilterChat({ userId: 123 });
  const next = vi.fn();
  await filter(ctx("private", 123), next);
  expect(next).toHaveBeenCalledOnce();
});

test("rejects non-matching user in private chat", () => {
  const filter = grammyFilterChat({ userId: 123 });
  const next = vi.fn();
  filter(ctx("private", 456, 2), next);
  expect(next).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledWith(
    "grammY rejected an unauthorized update",
    { update: { update_id: 2 } },
  );
});

test("rejects matching user in group chat", () => {
  const filter = grammyFilterChat({ userId: 123 });
  const next = vi.fn();
  filter(ctx("group", 123, 3), next);
  expect(next).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledWith(
    "grammY rejected an unauthorized update",
    { update: { update_id: 3 } },
  );
});

test("rejects matching user in supergroup chat", () => {
  const filter = grammyFilterChat({ userId: 123 });
  const next = vi.fn();
  filter(ctx("supergroup", 123, 4), next);
  expect(next).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledWith(
    "grammY rejected an unauthorized update",
    { update: { update_id: 4 } },
  );
});

test("rejects matching user in channel", () => {
  const filter = grammyFilterChat({ userId: 123 });
  const next = vi.fn();
  filter(ctx("channel", 123, 5), next);
  expect(next).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledWith(
    "grammY rejected an unauthorized update",
    { update: { update_id: 5 } },
  );
});

test("rejects when from is undefined", () => {
  const filter = grammyFilterChat({ userId: 123 });
  const next = vi.fn();
  filter(ctx("private", undefined, 6), next);
  expect(next).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledWith(
    "grammY rejected an unauthorized update",
    { update: { update_id: 6 } },
  );
});

test("rejects when chat is undefined", () => {
  const filter = grammyFilterChat({ userId: 123 });
  const next = vi.fn();
  filter(ctx(undefined, 123, 7), next);
  expect(next).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledWith(
    "grammY rejected an unauthorized update",
    { update: { update_id: 7 } },
  );
});
