import { expect, test, vi } from "vitest";
import { NestingSessions } from "~/lib/nesting-sessions";

function mockOpencodeClient() {
  return {
    session: {
      list: vi.fn(),
    },
  };
}

function session(id: string, parentID?: string) {
  return {
    id,
    slug: id,
    projectID: "p1",
    directory: "/tmp/project",
    title: id,
    version: "1",
    time: { created: 1, updated: 1 },
    ...(parentID ? { parentID } : {}),
  };
}

function setup() {
  const opencodeClient = mockOpencodeClient();
  const nesting = NestingSessions.create(opencodeClient as never);
  return { nesting, opencodeClient };
}

test("resolve returns the same ID for a root session", async () => {
  const { nesting } = setup();
  await nesting.update({
    type: "session.created",
    properties: {
      sessionID: "root",
      info: session("root"),
    },
  });
  expect(nesting.resolve("root")).toBe("root");
});

test("resolve returns the root ID for a child session", async () => {
  const { nesting } = setup();
  await nesting.update({
    type: "session.created",
    properties: {
      sessionID: "root",
      info: session("root"),
    },
  });
  await nesting.update({
    type: "session.created",
    properties: {
      sessionID: "child",
      info: session("child", "root"),
    },
  });
  await nesting.update({
    type: "session.created",
    properties: {
      sessionID: "grandchild",
      info: session("grandchild", "child"),
    },
  });
  expect(nesting.resolve("child")).toBe("root");
  expect(nesting.resolve("grandchild")).toBe("root");
});

test("update recalculates roots when parent changes", async () => {
  const { nesting } = setup();
  await nesting.update({
    type: "session.created",
    properties: {
      sessionID: "root-a",
      info: session("root-a"),
    },
  });
  await nesting.update({
    type: "session.created",
    properties: {
      sessionID: "root-b",
      info: session("root-b"),
    },
  });
  await nesting.update({
    type: "session.created",
    properties: {
      sessionID: "child",
      info: session("child", "root-a"),
    },
  });
  expect(nesting.resolve("child")).toBe("root-a");

  await nesting.update({
    type: "session.updated",
    properties: {
      sessionID: "child",
      info: session("child", "root-b"),
    },
  });
  expect(nesting.resolve("child")).toBe("root-b");
});

test("delete removes a whole subtree from the cache", async () => {
  const { nesting } = setup();
  await nesting.update({
    type: "session.created",
    properties: {
      sessionID: "root",
      info: session("root"),
    },
  });
  await nesting.update({
    type: "session.created",
    properties: {
      sessionID: "child",
      info: session("child", "root"),
    },
  });
  await nesting.update({
    type: "session.created",
    properties: {
      sessionID: "grandchild",
      info: session("grandchild", "child"),
    },
  });

  await nesting.update({
    type: "session.deleted",
    properties: {
      sessionID: "root",
      info: session("root"),
    },
  });

  expect(nesting.check("root")).toBe(false);
  expect(nesting.check("child")).toBe(false);
  expect(nesting.check("grandchild")).toBe(false);
});

test("invalidate rebuilds the mapping from server state", async () => {
  const { nesting, opencodeClient } = setup();
  opencodeClient.session.list.mockResolvedValue({
    data: [
      session("root"),
      session("child", "root"),
      session("grandchild", "child"),
      session("other-root"),
    ],
  });

  await nesting.invalidate();

  expect(opencodeClient.session.list).toHaveBeenCalledWith(
    {},
    { throwOnError: true },
  );
  expect(nesting.resolve("root")).toBe("root");
  expect(nesting.resolve("child")).toBe("root");
  expect(nesting.resolve("grandchild")).toBe("root");
  expect(nesting.resolve("other-root")).toBe("other-root");
});

test("resolve throws when session is unknown", () => {
  const { nesting } = setup();
  expect(() => nesting.resolve("missing")).toThrow("No nesting session found");
});
