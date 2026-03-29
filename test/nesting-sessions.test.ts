import { expect, test, vi } from "vitest";
import { NestingSessions } from "~/lib/nesting-sessions";

function setup() {
  const sessionGet = vi.fn();
  const opencodeClient = { session: { get: sessionGet } };
  const nestingSessions = NestingSessions.create(opencodeClient as never);
  return { nestingSessions, sessionGet };
}

test("returns sessionId when session has no parentID", async () => {
  const { nestingSessions, sessionGet } = setup();
  sessionGet.mockResolvedValue({ data: { id: "s1" } });
  const result = await nestingSessions.resolve("s1");
  expect(result).toBe("s1");
  expect(sessionGet).toHaveBeenCalledWith(
    { sessionID: "s1" },
    { throwOnError: true },
  );
});

test("follows parentID to root", async () => {
  const { nestingSessions, sessionGet } = setup();
  sessionGet
    .mockResolvedValueOnce({ data: { id: "child", parentID: "parent" } })
    .mockResolvedValueOnce({ data: { id: "parent" } });
  const result = await nestingSessions.resolve("child");
  expect(result).toBe("parent");
});

test("follows multi-level parentID chain", async () => {
  const { nestingSessions, sessionGet } = setup();
  sessionGet
    .mockResolvedValueOnce({
      data: { id: "grandchild", parentID: "child" },
    })
    .mockResolvedValueOnce({ data: { id: "child", parentID: "root" } })
    .mockResolvedValueOnce({ data: { id: "root" } });
  const result = await nestingSessions.resolve("grandchild");
  expect(result).toBe("root");
  expect(sessionGet).toHaveBeenCalledTimes(3);
});
