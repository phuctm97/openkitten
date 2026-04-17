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

// --- groupChat: false (default) ---

test("groupChat off: calls next for matching user in private chat", async () => {
  const filter = grammyFilterChat({ userId: 123, groupChat: false });
  const next = vi.fn();
  await filter(ctx("private", 123), next);
  expect(next).toHaveBeenCalledOnce();
});

test("groupChat off: rejects non-matching user in private chat", () => {
  const filter = grammyFilterChat({ userId: 123, groupChat: false });
  const next = vi.fn();
  filter(ctx("private", 456, 2), next);
  expect(next).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledWith(
    "grammY rejected an unauthorized update",
    { update: { update_id: 2 } },
  );
});

test("groupChat off: calls next for matching user in group chat", async () => {
  const filter = grammyFilterChat({ userId: 123, groupChat: false });
  const next = vi.fn();
  await filter(ctx("group", 123), next);
  expect(next).toHaveBeenCalledOnce();
});

test("groupChat off: rejects non-matching user in group chat", () => {
  const filter = grammyFilterChat({ userId: 123, groupChat: false });
  const next = vi.fn();
  filter(ctx("group", 456, 3), next);
  expect(next).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledWith(
    "grammY rejected an unauthorized update",
    { update: { update_id: 3 } },
  );
});

test("groupChat off: rejects when from is undefined", () => {
  const filter = grammyFilterChat({ userId: 123, groupChat: false });
  const next = vi.fn();
  filter(ctx("private", undefined, 4), next);
  expect(next).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledWith(
    "grammY rejected an unauthorized update",
    { update: { update_id: 4 } },
  );
});

test("groupChat off: calls next for matching user in channel", async () => {
  const filter = grammyFilterChat({ userId: 123, groupChat: false });
  const next = vi.fn();
  await filter(ctx("channel", 123, 5), next);
  expect(next).toHaveBeenCalledOnce();
});

test("groupChat off: rejects non-matching user in channel", () => {
  const filter = grammyFilterChat({ userId: 123, groupChat: false });
  const next = vi.fn();
  filter(ctx("channel", 456, 5), next);
  expect(next).not.toHaveBeenCalled();
});

// --- groupChat: true ---

test("groupChat on: calls next for matching user in private chat", async () => {
  const filter = grammyFilterChat({ userId: 123, groupChat: true });
  const next = vi.fn();
  await filter(ctx("private", 123), next);
  expect(next).toHaveBeenCalledOnce();
});

test("groupChat on: rejects non-matching user in private chat", () => {
  const filter = grammyFilterChat({ userId: 123, groupChat: true });
  const next = vi.fn();
  filter(ctx("private", 456, 6), next);
  expect(next).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledWith(
    "grammY rejected an unauthorized private update",
    { update: { update_id: 6 } },
  );
});

test("groupChat on: calls next for any user in group chat", async () => {
  const filter = grammyFilterChat({ userId: 123, groupChat: true });
  const next = vi.fn();
  await filter(ctx("group", 456), next);
  expect(next).toHaveBeenCalledOnce();
});

test("groupChat on: calls next for any user in supergroup chat", async () => {
  const filter = grammyFilterChat({ userId: 123, groupChat: true });
  const next = vi.fn();
  await filter(ctx("supergroup", 789), next);
  expect(next).toHaveBeenCalledOnce();
});

test("groupChat on: calls next for owner in group chat", async () => {
  const filter = grammyFilterChat({ userId: 123, groupChat: true });
  const next = vi.fn();
  await filter(ctx("group", 123), next);
  expect(next).toHaveBeenCalledOnce();
});

test("groupChat on: rejects channel updates", () => {
  const filter = grammyFilterChat({ userId: 123, groupChat: true });
  const next = vi.fn();
  filter(ctx("channel", 123, 7), next);
  expect(next).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledWith(
    "grammY rejected an update from unsupported chat type",
    { update: { update_id: 7 } },
  );
});

test("groupChat on: rejects when from is undefined in private chat", () => {
  const filter = grammyFilterChat({ userId: 123, groupChat: true });
  const next = vi.fn();
  filter(ctx("private", undefined, 8), next);
  expect(next).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledWith(
    "grammY rejected an unauthorized private update",
    { update: { update_id: 8 } },
  );
});

test("groupChat on: rejects when chat is undefined", () => {
  const filter = grammyFilterChat({ userId: 123, groupChat: true });
  const next = vi.fn();
  filter(ctx(undefined, 123, 9), next);
  expect(next).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledWith(
    "grammY rejected an update from unsupported chat type",
    { update: { update_id: 9 } },
  );
});
