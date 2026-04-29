import { afterEach, beforeEach, expect, it, vi } from "vitest";

const authClientMock = vi.hoisted(() => ({
  $store: { listen: vi.fn() },
}));

const queryClientMock = vi.hoisted(() => ({
  refetchQueries: vi.fn(),
  invalidateQueries: vi.fn(),
}));

const sessionQueryOptionsMock = vi.hoisted(() => ({
  queryKey: ["auth", "getSession", null] as const,
}));

const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock("~/lib/auth-client", () => ({ authClient: authClientMock }));
vi.mock("~/lib/query-client", () => ({ queryClient: queryClientMock }));
vi.mock("~/lib/session-query-options", () => ({
  sessionQueryOptions: sessionQueryOptionsMock,
}));
vi.mock("~/lib/toast-error", () => ({ toastError: toastErrorMock }));

beforeEach(() => {
  authClientMock.$store.listen.mockReset();
  queryClientMock.refetchQueries.mockReset();
  queryClientMock.invalidateQueries.mockReset();
  queryClientMock.refetchQueries.mockResolvedValue(undefined);
  toastErrorMock.mockReset();
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

it("registers a listener on the session signal", async () => {
  const { startAuthSessionSync } = await import("~/lib/auth-session-sync");
  startAuthSessionSync();
  expect(authClientMock.$store.listen).toHaveBeenCalledWith(
    "$sessionSignal",
    expect.any(Function),
  );
});

it("only registers the listener once across multiple calls", async () => {
  const { startAuthSessionSync } = await import("~/lib/auth-session-sync");
  startAuthSessionSync();
  startAuthSessionSync();
  startAuthSessionSync();
  expect(authClientMock.$store.listen).toHaveBeenCalledTimes(1);
});

it("refetches the session query and invalidates other queries when the signal fires", async () => {
  const { startAuthSessionSync } = await import("~/lib/auth-session-sync");
  startAuthSessionSync();
  const handler = authClientMock.$store.listen.mock.calls[0]?.[1] as
    | (() => void)
    | undefined;
  if (!handler) throw new Error("Expected a listener to be registered");
  handler();
  await Promise.resolve();
  await Promise.resolve();

  expect(queryClientMock.refetchQueries).toHaveBeenCalledWith({
    queryKey: sessionQueryOptionsMock.queryKey,
  });
  expect(queryClientMock.invalidateQueries).toHaveBeenCalledTimes(1);
  const predicate = queryClientMock.invalidateQueries.mock.calls[0]?.[0]
    .predicate as (query: { queryKey: unknown }) => boolean;
  expect(predicate({ queryKey: sessionQueryOptionsMock.queryKey })).toBe(false);
  expect(predicate({ queryKey: ["organizations"] })).toBe(true);
});

it("surfaces refetch failures via toastError and console.error", async () => {
  const refetchError = new Error("network down");
  queryClientMock.refetchQueries.mockRejectedValueOnce(refetchError);
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  const { startAuthSessionSync } = await import("~/lib/auth-session-sync");
  startAuthSessionSync();
  const handler = authClientMock.$store.listen.mock.calls[0]?.[1] as
    | (() => void)
    | undefined;
  if (!handler) throw new Error("Expected a listener to be registered");
  handler();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();

  expect(errorSpy).toHaveBeenCalledWith(
    "[auth-session-sync] failed to sync session",
    refetchError,
  );
  expect(toastErrorMock).toHaveBeenCalledWith(refetchError);
  expect(queryClientMock.invalidateQueries).not.toHaveBeenCalled();
  errorSpy.mockRestore();
});
