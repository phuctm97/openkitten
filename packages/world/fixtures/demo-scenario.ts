import type { Activity } from "~/domain/activity";
import type { Cat } from "~/domain/cat";
import type { Comment } from "~/domain/comment";
import type { Goal } from "~/domain/goal";
import type { House } from "~/domain/house";
import type { Human } from "~/domain/human";
import type { Notice } from "~/domain/notice";
import type { Session } from "~/domain/session";
import type { Thread } from "~/domain/thread";

type DemoScenario = {
  readonly house: House;
  readonly human: Human;
  readonly cats: readonly Cat[];
  readonly goals: readonly Goal[];
  readonly threads: readonly Thread[];
  readonly comments: readonly Comment[];
  readonly activities: readonly Activity[];
  readonly notices: readonly Notice[];
  readonly sessions: readonly Session[];
};

export const demoScenario = {
  house: {
    id: "house-lantern",
    name: "Lantern House",
    summary:
      "A calm house where Mochi handles launch polish while Pepper keeps docs, copy, and review loops tidy.",
    humanId: "human-phuc",
    catIds: ["cat-mochi", "cat-pepper"],
    goalIds: ["goal-house-slice", "goal-calm-demo"],
    threadIds: [
      "thread-panel-flow",
      "thread-landing-copy",
      "thread-phase-boundaries",
    ],
    noticeIds: [
      "notice-review-panel",
      "notice-copy-mention",
      "notice-transcript-preview",
    ],
    sessionIds: ["session-mochi-panel-flow"],
    props: [
      {
        id: "prop-mochi-desk",
        kind: "desk",
        label: "Mochi's brass-edged desk",
      },
      {
        id: "prop-house-inbox",
        kind: "inbox",
        label: "House inbox slot",
      },
      {
        id: "prop-launch-whiteboard",
        kind: "whiteboard",
        label: "Launch whiteboard",
      },
      {
        id: "prop-reference-cabinet",
        kind: "cabinet",
        label: "Reference cabinet",
      },
    ],
  },
  human: {
    id: "human-phuc",
    name: "Phuc",
    role: "House steward",
  },
  cats: [
    {
      id: "cat-mochi",
      name: "Mochi",
      role: "Builder cat",
      flavor: "Turns rough plans into crisp, readable product slices.",
      status: "Working",
      defaultExecutor: {
        id: "executor-codex-cloud",
        kind: "remote",
        label: "Codex Cloud",
      },
      assignedThreadIds: ["thread-panel-flow"],
      activeSessionId: "session-mochi-panel-flow",
    },
    {
      id: "cat-pepper",
      name: "Pepper",
      role: "House librarian",
      flavor:
        "Keeps docs, wording, and review loops organized for the next pass.",
      status: "Resting",
      defaultExecutor: {
        id: "executor-local-bun",
        kind: "local",
        label: "Local Bun",
      },
      assignedThreadIds: ["thread-landing-copy", "thread-phase-boundaries"],
    },
  ],
  goals: [
    {
      id: "goal-house-slice",
      title: "Ship a readable first house slice",
      description:
        "Make the browser client feel like a small house instead of a loose collection of demos.",
      status: "Open",
      threadIds: ["thread-panel-flow", "thread-landing-copy"],
    },
    {
      id: "goal-calm-demo",
      title: "Keep the world demo calm and legible",
      description:
        "Bias toward readable surfaces, stable fixtures, and obvious work context.",
      status: "Open",
      threadIds: ["thread-phase-boundaries"],
    },
  ],
  threads: [
    {
      id: "thread-panel-flow",
      title: "Draft the first readable session panel flow",
      summary:
        "Turn the current shell into a house slice the user can inspect in under a minute.",
      status: "Open",
      assigneeId: "cat-mochi",
      goalIds: ["goal-house-slice"],
      commentIds: [
        "comment-review-request",
        "comment-panel-plan",
        "comment-fixture-promise",
      ],
      activityIds: [
        "activity-thread-assigned",
        "activity-session-started",
        "activity-comment-added",
      ],
      currentSessionId: "session-mochi-panel-flow",
    },
    {
      id: "thread-landing-copy",
      title: "Tighten the house landing copy for the demo",
      summary:
        "Trim the intro language so the page reads like a product, not a placeholder.",
      status: "Open",
      assigneeId: "cat-pepper",
      goalIds: ["goal-house-slice"],
      commentIds: ["comment-copy-pass"],
      activityIds: ["activity-copy-note"],
    },
    {
      id: "thread-phase-boundaries",
      title: "Document the phase boundaries for the world slice",
      summary:
        "Keep the team clear on what phase 2 should establish before panels or live state land.",
      status: "Open",
      assigneeId: "cat-pepper",
      goalIds: ["goal-calm-demo"],
      commentIds: ["comment-phase-boundaries"],
      activityIds: ["activity-phase-note"],
    },
  ],
  comments: [
    {
      id: "comment-review-request",
      author: {
        id: "human-phuc",
        kind: "human",
        label: "Phuc",
      },
      timestamp: "2026-04-06T13:38:00.000Z",
      threadId: "thread-panel-flow",
      content:
        "Can you turn the current shell into something I can inspect quickly without guessing where the work is?",
      mentions: [],
    },
    {
      id: "comment-panel-plan",
      author: {
        id: "cat-mochi",
        kind: "cat",
        label: "Mochi",
      },
      timestamp: "2026-04-06T13:44:00.000Z",
      threadId: "thread-panel-flow",
      content:
        "I am shaping the next slice around one active session, a readable thread, and an inbox path that feels calm.",
      mentions: [
        {
          id: "goal-house-slice",
          kind: "goal",
          label: "Ship a readable first house slice",
        },
      ],
    },
    {
      id: "comment-fixture-promise",
      author: {
        id: "cat-mochi",
        kind: "cat",
        label: "Mochi",
      },
      timestamp: "2026-04-06T13:49:00.000Z",
      threadId: "thread-panel-flow",
      content:
        "Before the panels land, I am locking the house scenario so the cats, notices, and transcript all point at the same story.",
      mentions: [
        {
          id: "human-phuc",
          kind: "human",
          label: "Phuc",
        },
      ],
    },
    {
      id: "comment-copy-pass",
      author: {
        id: "cat-pepper",
        kind: "cat",
        label: "Pepper",
      },
      timestamp: "2026-04-06T13:41:00.000Z",
      threadId: "thread-landing-copy",
      content:
        "I tightened the landing copy so it emphasizes the house, the cats, and the readable work surfaces.",
      mentions: [
        {
          id: "human-phuc",
          kind: "human",
          label: "Phuc",
        },
      ],
    },
    {
      id: "comment-phase-boundaries",
      author: {
        id: "human-phuc",
        kind: "human",
        label: "Phuc",
      },
      timestamp: "2026-04-06T13:47:00.000Z",
      threadId: "thread-phase-boundaries",
      content:
        "Please keep phase 2 focused on domain shape and fixtures so the next phase can build on stable data.",
      mentions: [],
    },
  ],
  activities: [
    {
      id: "activity-thread-assigned",
      timestamp: "2026-04-06T13:36:00.000Z",
      actor: {
        id: "human-phuc",
        kind: "human",
        label: "Phuc",
      },
      type: "thread-assigned",
      subject: {
        id: "thread-panel-flow",
        kind: "thread",
        label: "Draft the first readable session panel flow",
      },
      payload: {
        assigneeId: "cat-mochi",
      },
    },
    {
      id: "activity-session-started",
      timestamp: "2026-04-06T13:52:00.000Z",
      actor: {
        id: "cat-mochi",
        kind: "cat",
        label: "Mochi",
      },
      type: "session-started",
      subject: {
        id: "session-mochi-panel-flow",
        kind: "session",
        label: "Mochi panel-flow session",
      },
      payload: {
        threadId: "thread-panel-flow",
      },
    },
    {
      id: "activity-comment-added",
      timestamp: "2026-04-06T13:49:00.000Z",
      actor: {
        id: "cat-mochi",
        kind: "cat",
        label: "Mochi",
      },
      type: "comment-added",
      subject: {
        id: "comment-fixture-promise",
        kind: "comment",
        label: "Fixture promise comment",
      },
      payload: {
        threadId: "thread-panel-flow",
      },
    },
    {
      id: "activity-copy-note",
      timestamp: "2026-04-06T13:41:00.000Z",
      actor: {
        id: "cat-pepper",
        kind: "cat",
        label: "Pepper",
      },
      type: "thread-updated",
      subject: {
        id: "thread-landing-copy",
        kind: "thread",
        label: "Tighten the house landing copy for the demo",
      },
      payload: {
        commentId: "comment-copy-pass",
      },
    },
    {
      id: "activity-phase-note",
      timestamp: "2026-04-06T13:47:00.000Z",
      actor: {
        id: "human-phuc",
        kind: "human",
        label: "Phuc",
      },
      type: "comment-added",
      subject: {
        id: "comment-phase-boundaries",
        kind: "comment",
        label: "Phase boundaries comment",
      },
      payload: {
        threadId: "thread-phase-boundaries",
      },
    },
  ],
  notices: [
    {
      id: "notice-review-panel",
      title: "Mochi asked for a quick panel-flow review",
      summary:
        "The active thread is ready for a readability pass before the panel layer lands.",
      status: "Unread",
      createdAt: "2026-04-06T13:50:00.000Z",
      target: {
        id: "comment-fixture-promise",
        kind: "comment",
        label: "Mochi's latest panel-flow note",
      },
      threadId: "thread-panel-flow",
    },
    {
      id: "notice-copy-mention",
      title: "Pepper mentioned you in the landing-copy thread",
      summary:
        "The intro copy now leans harder into the house metaphor and the two-cat story.",
      status: "Unread",
      createdAt: "2026-04-06T13:42:00.000Z",
      target: {
        id: "comment-copy-pass",
        kind: "comment",
        label: "Pepper's landing-copy note",
      },
      threadId: "thread-landing-copy",
    },
    {
      id: "notice-transcript-preview",
      title: "Transcript preview is ready for the next slice",
      summary:
        "The running session already has a short transcript the panel phase can render directly.",
      status: "Read",
      createdAt: "2026-04-06T13:58:00.000Z",
      target: {
        id: "session-mochi-panel-flow",
        kind: "session",
        label: "Mochi's current session",
      },
      threadId: "thread-panel-flow",
    },
  ],
  sessions: [
    {
      id: "session-mochi-panel-flow",
      catId: "cat-mochi",
      executor: {
        id: "executor-codex-cloud",
        kind: "remote",
        label: "Codex Cloud",
      },
      wakeReasons: [
        "A readability review is waiting on the panel-flow thread.",
        "The house needs one active session transcript the next phase can inspect.",
      ],
      claimedThreadIds: ["thread-panel-flow"],
      status: "Running",
      startedAt: "2026-04-06T13:52:00.000Z",
      transcript: {
        id: "transcript-mochi-panel-flow",
        sessionId: "session-mochi-panel-flow",
        entries: [
          {
            id: "transcript-entry-1",
            timestamp: "2026-04-06T13:52:00.000Z",
            kind: "status",
            content: "Session started from the panel-flow review notice.",
          },
          {
            id: "transcript-entry-2",
            timestamp: "2026-04-06T13:54:00.000Z",
            kind: "thought",
            content:
              "Mapped the current house shell to the future panel surfaces and kept the story focused on one active cat.",
          },
          {
            id: "transcript-entry-3",
            timestamp: "2026-04-06T13:56:00.000Z",
            kind: "tool",
            content:
              "Compared the implementation plan against the live shell and marked the missing data entry points.",
          },
          {
            id: "transcript-entry-4",
            timestamp: "2026-04-06T13:58:00.000Z",
            kind: "message",
            content:
              "Drafting a fixture-driven overview so the next phase can open real panels without rewriting the story.",
          },
        ],
      },
    },
  ],
} satisfies DemoScenario;
