import { afterEach, beforeEach, expect, it, vi } from "vitest";

const sessionAtomMock = vi.hoisted(() => ({
  get: vi.fn<() => { data: { session?: { id: string | undefined } } }>(),
}));

const authClientMock = vi.hoisted(() => ({
  $store: {
    listen: vi.fn(),
    atoms: { session: sessionAtomMock },
  },
}));

const queryClientMock = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
}));

const sessionQueryOptionsMock = vi.hoisted(() => ({
  queryKey: ["auth", "getSession", null] as const,
}));

vi.mock("~/lib/auth-client", () => ({ authClient: authClientMock }));
vi.mock("~/lib/query-client", () => ({ queryClient: queryClientMock }));
vi.mock("~/lib/session-query-options", () => ({
  sessionQueryOptions: sessionQueryOptionsMock,
}));

beforeEach(() => {
  authClientMock.$store.listen.mockReset();
  queryClientMock.invalidateQueries.mockReset();
  sessionAtomMock.get.mockReset();
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

it("registers a listener on the session signal", async () => {
  const { startAuthSessionSync } = await import(
    "~/lib/start-auth-session-sync"
  );
  startAuthSessionSync();
  expect(authClientMock.$store.listen).toHaveBeenCalledWith(
    "$sessionSignal",
    expect.any(Function),
  );
});

it("only registers the listener once across multiple calls", async () => {
  const { startAuthSessionSync } = await import(
    "~/lib/start-auth-session-sync"
  );
  startAuthSessionSync();
  startAuthSessionSync();
  startAuthSessionSync();
  expect(authClientMock.$store.listen).toHaveBeenCalledTimes(1);
});

it("does not invalidate the session query on the first signal fire", async () => {
  sessionAtomMock.get.mockReturnValue({ data: { session: { id: "s_1" } } });
  const { startAuthSessionSync } = await import(
    "~/lib/start-auth-session-sync"
  );
  startAuthSessionSync();
  const handler = authClientMock.$store.listen.mock.calls[0]?.[1] as
    | (() => void)
    | undefined;
  if (!handler) throw new Error("Expected a listener to be registered");
  handler();
  expect(queryClientMock.invalidateQueries).not.toHaveBeenCalled();
});

it("invalidates the session query when the session id changes after initialization", async () => {
  sessionAtomMock.get.mockReturnValueOnce({
    data: { session: { id: "s_1" } },
  });
  sessionAtomMock.get.mockReturnValueOnce({
    data: { session: { id: "s_2" } },
  });
  const { startAuthSessionSync } = await import(
    "~/lib/start-auth-session-sync"
  );
  startAuthSessionSync();
  const handler = authClientMock.$store.listen.mock.calls[0]?.[1] as
    | (() => void)
    | undefined;
  if (!handler) throw new Error("Expected a listener to be registered");
  handler();
  handler();
  expect(queryClientMock.invalidateQueries).toHaveBeenCalledTimes(1);
  expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
    queryKey: sessionQueryOptionsMock.queryKey,
  });
});

it("does not invalidate when the session id stays the same after initialization", async () => {
  sessionAtomMock.get.mockReturnValue({ data: { session: { id: "s_1" } } });
  const { startAuthSessionSync } = await import(
    "~/lib/start-auth-session-sync"
  );
  startAuthSessionSync();
  const handler = authClientMock.$store.listen.mock.calls[0]?.[1] as
    | (() => void)
    | undefined;
  if (!handler) throw new Error("Expected a listener to be registered");
  handler();
  handler();
  expect(queryClientMock.invalidateQueries).not.toHaveBeenCalled();
});

it("treats a missing session atom as an undefined session id", async () => {
  authClientMock.$store.atoms = {} as never;
  const { startAuthSessionSync } = await import(
    "~/lib/start-auth-session-sync"
  );
  startAuthSessionSync();
  const handler = authClientMock.$store.listen.mock.calls[0]?.[1] as
    | (() => void)
    | undefined;
  if (!handler) throw new Error("Expected a listener to be registered");
  handler();
  handler();
  expect(queryClientMock.invalidateQueries).not.toHaveBeenCalled();
  authClientMock.$store.atoms = { session: sessionAtomMock };
});
