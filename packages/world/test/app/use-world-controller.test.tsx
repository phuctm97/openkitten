import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { useWorldController } from "~/app/use-world-controller";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

test("derives transcript playback, selection, and reactions from the controller state", () => {
  const { result } = renderHook(() => useWorldController());

  expect(result.current.unreadNoticeCount).toBe(2);
  expect(result.current.visibleTranscript).toHaveLength(2);
  expect(result.current.state.focus.kind).toBe("overview");
  expect(result.current.spotlightCatId).toBeNull();
  expect(result.current.spotlightThreadId).toBeNull();

  act(() => {
    result.current.showCat("cat-mochi");
  });

  expect(result.current.selectedCat?.name).toBe("Mochi");
  expect(result.current.spotlightCatId).toBe("cat-mochi");

  act(() => {
    result.current.showThread("thread-pricing");
  });

  expect(result.current.selectedThread?.title).toBe(
    "Pricing review for launch page",
  );
  expect(result.current.spotlightCatId).toBe("cat-mochi");
  expect(result.current.spotlightThreadId).toBe("thread-pricing");

  act(() => {
    result.current.showSession("session-mochi-pricing");
  });

  expect(result.current.state.focus.kind).toBe("session");
  expect(result.current.spotlightThreadId).toBe("thread-pricing");

  act(() => {
    result.current.showCat("missing-cat");
  });

  expect(result.current.selectedCat).toBeNull();

  act(() => {
    result.current.showThread("missing-thread");
  });

  expect(result.current.selectedThread).toBeNull();
  expect(result.current.spotlightCatId).toBeNull();

  act(() => {
    result.current.showInbox();
    result.current.showWhiteboard();
    result.current.showCabinet();
    result.current.showOverview();
    result.current.openNotice("notice-1");
  });

  expect(result.current.state.focus).toEqual({
    kind: "thread",
    id: "thread-pricing",
  });
  expect(result.current.activeReaction?.message).toBe(
    "Review requested on pricing review",
  );

  act(() => {
    result.current.addComment("thread-pricing", "One more practical note.");
  });

  expect(result.current.selectedThread?.comments.at(-1)?.body).toBe(
    "One more practical note.",
  );
  expect(result.current.activeReaction?.message).toBe(
    "Pricing review for launch page stirred the room.",
  );

  act(() => {
    vi.advanceTimersByTime(4_800);
  });

  expect(result.current.visibleTranscript).toHaveLength(5);
  expect(result.current.activeReaction).toBeNull();
});
