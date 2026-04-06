import { expect, test } from "vitest";

import { demoScenario } from "~/fixtures/demo-scenario";
import { expectValue } from "~/lib/expect-value";

test("provides the fixed phase 2 house scenario", () => {
  expect(demoScenario.house.name).toBe("Lantern House");
  expect(demoScenario.human.name).toBe("Phuc");
  expect(demoScenario.cats.map((cat) => cat.name)).toEqual(["Mochi", "Pepper"]);
  expect(demoScenario.goals.map((goal) => goal.title)).toEqual([
    "Ship a readable first house slice",
    "Keep the world demo calm and legible",
  ]);
  expect(demoScenario.threads).toHaveLength(3);
  expect(demoScenario.notices).toHaveLength(3);
  expect(
    expectValue(
      demoScenario.sessions[0],
      "Expected the demo scenario to expose one active session.",
    ).status,
  ).toBe("Running");
});

test("keeps house references aligned across threads, notices, and the active session", () => {
  const catIds = new Set(demoScenario.cats.map((cat) => cat.id));
  const commentIds = new Set(
    demoScenario.comments.map((comment) => comment.id),
  );
  const activityIds = new Set(
    demoScenario.activities.map((activity) => activity.id),
  );
  const threadIds = new Set(demoScenario.threads.map((thread) => thread.id));
  const activeSession = expectValue(
    demoScenario.sessions[0],
    "Expected the demo scenario to expose one active session.",
  );
  const activeTranscript = expectValue(
    activeSession.transcript,
    "Expected the demo scenario to expose one active transcript.",
  );

  expect(demoScenario.house.threadIds).toEqual(
    demoScenario.threads.map((thread) => thread.id),
  );
  expect(demoScenario.house.noticeIds).toEqual(
    demoScenario.notices.map((notice) => notice.id),
  );
  expect(demoScenario.house.sessionIds).toEqual(
    demoScenario.sessions.map((session) => session.id),
  );

  for (const thread of demoScenario.threads) {
    expect(catIds.has(thread.assigneeId ?? "")).toBe(true);
    expect(
      thread.commentIds.every((commentId) => commentIds.has(commentId)),
    ).toBe(true);
    expect(
      thread.activityIds.every((activityId) => activityIds.has(activityId)),
    ).toBe(true);
  }

  expect(
    activeSession.claimedThreadIds.every((threadId) => threadIds.has(threadId)),
  ).toBe(true);
  expect(activeTranscript.entries.map((entry) => entry.kind)).toEqual([
    "status",
    "thought",
    "tool",
    "message",
  ]);
});
