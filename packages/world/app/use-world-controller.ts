import { useEffect, useEffectEvent, useReducer } from "react";

import { createWorldState } from "~/lib/create-world-state";
import { worldReducer } from "~/lib/world-reducer";

function useWorldController() {
  const [state, dispatch] = useReducer(
    worldReducer,
    undefined,
    createWorldState,
  );

  const handleTick = useEffectEvent(() => {
    dispatch({
      type: "tick",
    });
  });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      handleTick();
    }, 1_200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const unreadNoticeCount = state.world.notices.filter(
    (notice) => !notice.isRead,
  ).length;
  const activeSession = state.world.session;
  const focus = state.focus;
  const visibleTranscriptCount = Math.min(
    activeSession.transcript.length,
    2 + state.worldClock,
  );
  const visibleTranscript = activeSession.transcript.slice(
    0,
    visibleTranscriptCount,
  );
  let selectedCat: (typeof state.world.cats)[number] | null = null;

  if (focus.kind === "cat") {
    selectedCat = state.world.cats.find((cat) => cat.id === focus.id) ?? null;
  }

  let selectedThread: (typeof state.world.threads)[number] | null = null;

  if (focus.kind === "thread") {
    selectedThread =
      state.world.threads.find((thread) => thread.id === focus.id) ?? null;
  }
  const activeReaction =
    state.reaction !== null && state.worldClock - state.reaction.startedAt < 4
      ? state.reaction
      : null;
  let spotlightCatId: string | null = null;

  if (activeReaction !== null) {
    spotlightCatId = activeReaction.catId;
  } else if (focus.kind === "cat") {
    spotlightCatId = focus.id;
  } else if (focus.kind === "thread") {
    spotlightCatId =
      state.world.threads.find((thread) => thread.id === focus.id)
        ?.assigneeId ?? null;
  } else if (focus.kind === "session") {
    spotlightCatId = state.world.session.catId;
  }

  let spotlightThreadId: string | null = null;

  if (focus.kind === "thread") {
    spotlightThreadId = focus.id;
  } else if (focus.kind === "session") {
    spotlightThreadId = state.world.session.threadId;
  }

  return {
    state,
    unreadNoticeCount,
    visibleTranscript,
    activeReaction,
    spotlightCatId,
    spotlightThreadId,
    selectedCat,
    selectedThread,
    activeSession,
    showOverview() {
      dispatch({
        type: "focus-overview",
      });
    },
    showCat(catId: string) {
      dispatch({
        type: "focus-cat",
        catId,
      });
    },
    showThread(threadId: string) {
      dispatch({
        type: "focus-thread",
        threadId,
      });
    },
    showSession(sessionId: string) {
      dispatch({
        type: "focus-session",
        sessionId,
      });
    },
    showInbox() {
      dispatch({
        type: "focus-inbox",
      });
    },
    showWhiteboard() {
      dispatch({
        type: "focus-whiteboard",
      });
    },
    showCabinet() {
      dispatch({
        type: "focus-cabinet",
      });
    },
    openNotice(noticeId: string) {
      dispatch({
        type: "open-notice",
        noticeId,
      });
    },
    addComment(threadId: string, body: string) {
      dispatch({
        type: "add-comment",
        threadId,
        body,
      });
    },
  };
}

export { useWorldController };
