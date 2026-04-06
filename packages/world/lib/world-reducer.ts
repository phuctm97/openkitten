import type { createWorldState } from "~/lib/create-world-state";

type WorldState = ReturnType<typeof createWorldState>;

type WorldAction =
  | {
      type: "tick";
    }
  | {
      type: "focus-overview";
    }
  | {
      type: "focus-cat";
      catId: string;
    }
  | {
      type: "focus-thread";
      threadId: string;
    }
  | {
      type: "focus-session";
      sessionId: string;
    }
  | {
      type: "focus-inbox";
    }
  | {
      type: "focus-whiteboard";
    }
  | {
      type: "focus-cabinet";
    }
  | {
      type: "open-notice";
      noticeId: string;
    }
  | {
      type: "add-comment";
      threadId: string;
      body: string;
    };

function worldReducer(state: WorldState, action: WorldAction): WorldState {
  if (action.type === "tick") {
    return {
      ...state,
      worldClock: state.worldClock + 1,
    };
  }

  if (action.type === "focus-overview") {
    return {
      ...state,
      focus: {
        kind: "overview",
      },
    };
  }

  if (action.type === "focus-cat") {
    return {
      ...state,
      focus: {
        kind: "cat",
        id: action.catId,
      },
    };
  }

  if (action.type === "focus-thread") {
    return {
      ...state,
      focus: {
        kind: "thread",
        id: action.threadId,
      },
    };
  }

  if (action.type === "focus-session") {
    return {
      ...state,
      focus: {
        kind: "session",
        id: action.sessionId,
      },
    };
  }

  if (action.type === "focus-inbox") {
    return {
      ...state,
      focus: {
        kind: "inbox",
      },
    };
  }

  if (action.type === "focus-whiteboard") {
    return {
      ...state,
      focus: {
        kind: "whiteboard",
      },
    };
  }

  if (action.type === "focus-cabinet") {
    return {
      ...state,
      focus: {
        kind: "cabinet",
      },
    };
  }

  if (action.type === "open-notice") {
    const notice = state.world.notices.find(
      (item) => item.id === action.noticeId,
    );

    if (notice === undefined) {
      return state;
    }

    const nextWorld = {
      ...state.world,
      notices: state.world.notices.map((item) =>
        item.id === action.noticeId
          ? {
              ...item,
              isRead: true,
            }
          : item,
      ),
    };

    const reactionCatId =
      notice.target.kind === "cat"
        ? notice.target.id
        : (nextWorld.threads.find((thread) => thread.id === notice.target.id)
            ?.assigneeId ?? nextWorld.session.catId);

    return {
      ...state,
      world: nextWorld,
      focus:
        notice.target.kind === "cat"
          ? {
              kind: "cat",
              id: notice.target.id,
            }
          : {
              kind: "thread",
              id: notice.target.id,
            },
      reaction: {
        catId: reactionCatId,
        message: notice.title,
        startedAt: state.worldClock,
      },
    };
  }

  const thread = state.world.threads.find(
    (item) => item.id === action.threadId,
  );
  const nextBody = action.body.trim();

  if (thread === undefined || nextBody.length === 0) {
    return state;
  }

  const nextComment = {
    id: `comment-${state.nextCommentNumber}`,
    authorId: state.world.human.id,
    authorName: state.world.human.name,
    body: nextBody,
    tone: "Human note",
    postedAt: "just now",
  };
  const nextActivity = {
    id: `activity-${state.nextActivityNumber}`,
    description: `${state.world.human.name} added a steering note for ${thread.title}.`,
    happenedAt: "just now",
  };
  const nextWorld = {
    ...state.world,
    threads: state.world.threads.map((item) =>
      item.id === action.threadId
        ? {
            ...item,
            comments: [...item.comments, nextComment],
            activities: [nextActivity, ...item.activities],
          }
        : item,
    ),
  };

  return {
    ...state,
    world: nextWorld,
    focus: {
      kind: "thread",
      id: thread.id,
    },
    reaction: {
      catId: thread.assigneeId,
      message: `${thread.title} stirred the room.`,
      startedAt: state.worldClock,
    },
    nextCommentNumber: state.nextCommentNumber + 1,
    nextActivityNumber: state.nextActivityNumber + 1,
  };
}

export { worldReducer };
