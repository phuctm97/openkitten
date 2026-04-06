type WorldFixture = {
  house: {
    id: string;
    name: string;
    tagline: string;
    summary: string;
    mood: string;
  };
  human: {
    id: string;
    name: string;
    role: string;
  };
  goals: Array<{
    id: string;
    title: string;
    summary: string;
    status: string;
  }>;
  cats: Array<{
    id: string;
    name: string;
    role: string;
    flavor: string;
    status: string;
    stationLabel: string;
    accent: string;
    stationColor: string;
    pose: "working" | "resting";
    activeSessionId: string | null;
    threadIds: string[];
  }>;
  threads: Array<{
    id: string;
    title: string;
    assigneeId: string;
    status: "Open" | "Closed";
    summary: string;
    goalId: string;
    sessionId: string | null;
    comments: Array<{
      id: string;
      authorId: string;
      authorName: string;
      body: string;
      tone: string;
      postedAt: string;
    }>;
    activities: Array<{
      id: string;
      description: string;
      happenedAt: string;
    }>;
  }>;
  notices: Array<{
    id: string;
    title: string;
    body: string;
    createdAt: string;
    tone: "review" | "mention" | "update";
    target:
      | {
          kind: "thread";
          id: string;
        }
      | {
          kind: "cat";
          id: string;
        };
    isRead: boolean;
  }>;
  session: {
    id: string;
    catId: string;
    threadId: string;
    status: string;
    locationLabel: string;
    transcript: Array<{
      id: string;
      speaker: string;
      kind: "plan" | "tool" | "note";
      body: string;
      at: string;
    }>;
  };
  whiteboard: {
    id: string;
    title: string;
    cues: string[];
  };
  cabinet: {
    id: string;
    title: string;
    files: Array<{
      id: string;
      name: string;
      note: string;
    }>;
  };
};

const worldFixture: WorldFixture = {
  house: {
    id: "house-lantern",
    name: "Lantern House",
    tagline: "A warm study where serious async work feels alive.",
    summary:
      "Mina is steering a calm little house while Mochi works the current thread and Pepper keeps a watchful rest nearby.",
    mood: "Rainy evening glow",
  },
  human: {
    id: "human-mina",
    name: "Mina",
    role: "House steward",
  },
  goals: [
    {
      id: "goal-pricing",
      title: "Ship a human pricing review",
      summary: "Turn scattered research into one readable recommendation.",
      status: "Current",
    },
    {
      id: "goal-onboarding",
      title: "Make onboarding calmer",
      summary: "Clarify the first-run prompts before launch week.",
      status: "Queued",
    },
  ],
  cats: [
    {
      id: "cat-mochi",
      name: "Mochi",
      role: "Research cat",
      flavor: "Keeps strategy practical, gentle, and sharp.",
      status: "Working at the planning desk",
      stationLabel: "Planning desk",
      accent: "#ef8b57",
      stationColor: "#ffb571",
      pose: "working",
      activeSessionId: "session-mochi-pricing",
      threadIds: ["thread-pricing", "thread-rollout"],
    },
    {
      id: "cat-pepper",
      name: "Pepper",
      role: "Library cat",
      flavor: "Collects references and settles noisy ideas down.",
      status: "Resting near the window",
      stationLabel: "Window nook",
      accent: "#5d6f8d",
      stationColor: "#8ca2c7",
      pose: "resting",
      activeSessionId: null,
      threadIds: ["thread-onboarding"],
    },
  ],
  threads: [
    {
      id: "thread-pricing",
      title: "Pricing review for launch page",
      assigneeId: "cat-mochi",
      status: "Open",
      summary:
        "Draft a practical recommendation that keeps the offer legible and humane.",
      goalId: "goal-pricing",
      sessionId: "session-mochi-pricing",
      comments: [
        {
          id: "comment-1",
          authorId: "human-mina",
          authorName: "Mina",
          body: "Keep the recommendation easy to explain to a first-time buyer.",
          tone: "Steering memo",
          postedAt: "15 minutes ago",
        },
        {
          id: "comment-2",
          authorId: "cat-mochi",
          authorName: "Mochi",
          body: "I am comparing a simple tiered offer against a single-plan approach now.",
          tone: "Cat update",
          postedAt: "6 minutes ago",
        },
      ],
      activities: [
        {
          id: "activity-1",
          description:
            "Mochi reopened the thread after finding a clearer angle.",
          happenedAt: "12 minutes ago",
        },
        {
          id: "activity-2",
          description: "Session linked to the thread for live review.",
          happenedAt: "8 minutes ago",
        },
      ],
    },
    {
      id: "thread-onboarding",
      title: "First-run house onboarding",
      assigneeId: "cat-pepper",
      status: "Open",
      summary:
        "Collect references for a softer first impression and fewer sharp edges.",
      goalId: "goal-onboarding",
      sessionId: null,
      comments: [
        {
          id: "comment-3",
          authorId: "cat-pepper",
          authorName: "Pepper",
          body: "I left a few calmer copy directions on the whiteboard.",
          tone: "House note",
          postedAt: "28 minutes ago",
        },
      ],
      activities: [
        {
          id: "activity-3",
          description:
            "Pepper gathered onboarding references into the cabinet.",
          happenedAt: "31 minutes ago",
        },
      ],
    },
    {
      id: "thread-rollout",
      title: "Post-launch check-in rhythm",
      assigneeId: "cat-mochi",
      status: "Closed",
      summary:
        "Define the first weekly follow-up ritual once pricing guidance is shipped.",
      goalId: "goal-pricing",
      sessionId: null,
      comments: [
        {
          id: "comment-4",
          authorId: "human-mina",
          authorName: "Mina",
          body: "This can wait until the launch copy is settled.",
          tone: "Decision",
          postedAt: "Yesterday",
        },
      ],
      activities: [
        {
          id: "activity-4",
          description: "Thread closed until launch copy is approved.",
          happenedAt: "Yesterday",
        },
      ],
    },
  ],
  notices: [
    {
      id: "notice-1",
      title: "Review requested on pricing review",
      body: "Mochi is ready for a human nudge on the current recommendation.",
      createdAt: "3 minutes ago",
      tone: "review",
      target: {
        kind: "thread",
        id: "thread-pricing",
      },
      isRead: false,
    },
    {
      id: "notice-2",
      title: "Mochi mentioned Mina",
      body: "The active session has a note asking whether clarity should beat breadth.",
      createdAt: "7 minutes ago",
      tone: "mention",
      target: {
        kind: "cat",
        id: "cat-mochi",
      },
      isRead: false,
    },
    {
      id: "notice-3",
      title: "Onboarding references changed",
      body: "Pepper refreshed the cabinet with calmer examples for first-run copy.",
      createdAt: "24 minutes ago",
      tone: "update",
      target: {
        kind: "thread",
        id: "thread-onboarding",
      },
      isRead: true,
    },
  ],
  session: {
    id: "session-mochi-pricing",
    catId: "cat-mochi",
    threadId: "thread-pricing",
    status: "Running in OpenCode",
    locationLabel: "Desk lamp, notebook, and pricing sheets",
    transcript: [
      {
        id: "line-1",
        speaker: "Mochi",
        kind: "plan",
        body: "Starting with the simplest offer structure so the recommendation stays legible.",
        at: "now",
      },
      {
        id: "line-2",
        speaker: "OpenCode",
        kind: "tool",
        body: "Opened the pricing notes and launch copy references from the cabinet.",
        at: "now",
      },
      {
        id: "line-3",
        speaker: "Mochi",
        kind: "note",
        body: "Single-plan clarity looks strong, but I want one fallback tier for larger teams.",
        at: "in a moment",
      },
      {
        id: "line-4",
        speaker: "Mochi",
        kind: "plan",
        body: "Preparing a recommendation that explains the tradeoff in plain language for Mina.",
        at: "soon",
      },
      {
        id: "line-5",
        speaker: "OpenCode",
        kind: "tool",
        body: "Linked the active reasoning back to the thread for review.",
        at: "soon",
      },
    ],
  },
  whiteboard: {
    id: "whiteboard-main",
    title: "House whiteboard",
    cues: [
      "Keep pricing practical and first-time-buyer friendly.",
      "Prefer one clear steering action over a long chat.",
      "Let Pepper collect calm onboarding references next.",
    ],
  },
  cabinet: {
    id: "cabinet-references",
    title: "Reference cabinet",
    files: [
      {
        id: "file-1",
        name: "pricing-notes.md",
        note: "Current draft comparisons for the launch offer.",
      },
      {
        id: "file-2",
        name: "onboarding-moodboard.pdf",
        note: "Soft, readable examples Pepper wants to borrow from.",
      },
      {
        id: "file-3",
        name: "launch-copy-outline.txt",
        note: "The thread-connected outline Mochi is reviewing right now.",
      },
    ],
  },
};

export { worldFixture };
