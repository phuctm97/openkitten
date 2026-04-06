import { expect, test } from "vitest";

import { createWorldState } from "~/lib/create-world-state";
import { worldReducer } from "~/lib/world-reducer";

test("handles world ticks and focus changes", () => {
  const initial = createWorldState();
  const ticked = worldReducer(initial, {
    type: "tick",
  });
  const catFocus = worldReducer(initial, {
    type: "focus-cat",
    catId: "cat-mochi",
  });
  const threadFocus = worldReducer(initial, {
    type: "focus-thread",
    threadId: "thread-pricing",
  });
  const sessionFocus = worldReducer(initial, {
    type: "focus-session",
    sessionId: "session-mochi-pricing",
  });
  const inboxFocus = worldReducer(initial, {
    type: "focus-inbox",
  });
  const whiteboardFocus = worldReducer(initial, {
    type: "focus-whiteboard",
  });
  const cabinetFocus = worldReducer(initial, {
    type: "focus-cabinet",
  });
  const overviewFocus = worldReducer(catFocus, {
    type: "focus-overview",
  });

  expect(ticked.worldClock).toBe(1);
  expect(catFocus.focus).toEqual({
    kind: "cat",
    id: "cat-mochi",
  });
  expect(threadFocus.focus).toEqual({
    kind: "thread",
    id: "thread-pricing",
  });
  expect(sessionFocus.focus).toEqual({
    kind: "session",
    id: "session-mochi-pricing",
  });
  expect(inboxFocus.focus).toEqual({
    kind: "inbox",
  });
  expect(whiteboardFocus.focus).toEqual({
    kind: "whiteboard",
  });
  expect(cabinetFocus.focus).toEqual({
    kind: "cabinet",
  });
  expect(overviewFocus.focus).toEqual({
    kind: "overview",
  });
});

test("opens notices, marks them read, and falls back to the active session cat when needed", () => {
  const initial = createWorldState();
  const unchanged = worldReducer(initial, {
    type: "open-notice",
    noticeId: "missing",
  });
  const threadNotice = worldReducer(initial, {
    type: "open-notice",
    noticeId: "notice-1",
  });
  const catNotice = worldReducer(initial, {
    type: "open-notice",
    noticeId: "notice-2",
  });

  const fallbackState = createWorldState();
  const firstNotice = fallbackState.world.notices[0];

  if (firstNotice) {
    firstNotice.target = {
      kind: "thread",
      id: "missing-thread",
    };
  }

  const fallbackNotice = worldReducer(fallbackState, {
    type: "open-notice",
    noticeId: "notice-1",
  });

  expect(unchanged).toBe(initial);
  expect(threadNotice.focus).toEqual({
    kind: "thread",
    id: "thread-pricing",
  });
  expect(threadNotice.world.notices[0]?.isRead).toBe(true);
  expect(threadNotice.reaction?.catId).toBe("cat-mochi");
  expect(catNotice.focus).toEqual({
    kind: "cat",
    id: "cat-mochi",
  });
  expect(catNotice.world.notices[1]?.isRead).toBe(true);
  expect(fallbackNotice.reaction?.catId).toBe(
    fallbackNotice.world.session.catId,
  );
});

test("adds a comment only for real open thread input", () => {
  const initial = createWorldState();
  const missingThread = worldReducer(initial, {
    type: "add-comment",
    threadId: "missing",
    body: "Useful note",
  });
  const blankComment = worldReducer(initial, {
    type: "add-comment",
    threadId: "thread-pricing",
    body: "   ",
  });
  const next = worldReducer(initial, {
    type: "add-comment",
    threadId: "thread-pricing",
    body: "Keep the recommendation short and humane.",
  });

  expect(missingThread).toBe(initial);
  expect(blankComment).toBe(initial);
  expect(next.focus).toEqual({
    kind: "thread",
    id: "thread-pricing",
  });
  expect(next.world.threads[0]?.comments.at(-1)?.body).toBe(
    "Keep the recommendation short and humane.",
  );
  expect(next.world.threads[0]?.activities[0]?.description).toContain(
    "Mina added a steering note",
  );
  expect(next.nextCommentNumber).toBe(6);
  expect(next.nextActivityNumber).toBe(6);
  expect(next.reaction?.message).toBe(
    "Pricing review for launch page stirred the room.",
  );
});
