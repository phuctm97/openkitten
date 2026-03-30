import { expect, test, vi } from "vitest";
import { resolveRootSessionId } from "~/lib/resolve-root-session-id";

function setup() {
  const sessionGet = vi.fn();
  const opencodeClient = { session: { get: sessionGet } };
  return { opencodeClient: opencodeClient as never, sessionGet };
}

test("returns sessionId when session has no parentID", async () => {
  const { opencodeClient, sessionGet } = setup();
  sessionGet.mockResolvedValue({ data: { id: "s1" } });
  const result = await resolveRootSessionId(opencodeClient, "s1");
  expect(result).toBe("s1");
  expect(sessionGet).toHaveBeenCalledWith(
    { sessionID: "s1" },
    { throwOnError: true },
  );
});

test("follows parentID to root", async () => {
  const { opencodeClient, sessionGet } = setup();
  sessionGet
    .mockResolvedValueOnce({ data: { id: "child", parentID: "parent" } })
    .mockResolvedValueOnce({ data: { id: "parent" } });
  const result = await resolveRootSessionId(opencodeClient, "child");
  expect(result).toBe("parent");
});

test("follows multi-level parentID chain", async () => {
  const { opencodeClient, sessionGet } = setup();
  sessionGet
    .mockResolvedValueOnce({
      data: { id: "grandchild", parentID: "child" },
    })
    .mockResolvedValueOnce({ data: { id: "child", parentID: "root" } })
    .mockResolvedValueOnce({ data: { id: "root" } });
  const result = await resolveRootSessionId(opencodeClient, "grandchild");
  expect(result).toBe("root");
  expect(sessionGet).toHaveBeenCalledTimes(3);
});
