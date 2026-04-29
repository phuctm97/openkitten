import { expect, it, vi } from "vitest";

const authClientMock = vi.hoisted(() => ({
  organization: {
    getInvitation: vi.fn(),
  },
}));

vi.mock("~/lib/auth-client", () => ({ authClient: authClientMock }));

const { getInvitationQueryOptions } = await import(
  "~/lib/get-invitation-query-options"
);

it("disables the query when no invitationId is provided", () => {
  const options = getInvitationQueryOptions(undefined);
  expect(options.queryKey).toStrictEqual(["organizations", "invitation", null]);
  expect(options.enabled).toBe(false);
});

it("enables the query and exposes a stable key when an id is provided", () => {
  const options = getInvitationQueryOptions("inv_1");
  expect(options.queryKey).toStrictEqual([
    "organizations",
    "invitation",
    "inv_1",
  ]);
  expect(options.enabled).toBe(true);
});

it("delegates to authClient.organization.getInvitation with the abort signal", async () => {
  const options = getInvitationQueryOptions("inv_1");
  const controller = new AbortController();
  authClientMock.organization.getInvitation.mockResolvedValueOnce({
    id: "inv_1",
  });

  const result = await options.queryFn?.({
    queryKey: options.queryKey,
    signal: controller.signal,
    meta: undefined,
    client: undefined as never,
  });

  expect(result).toStrictEqual({ id: "inv_1" });
  expect(authClientMock.organization.getInvitation).toHaveBeenCalledWith({
    query: { id: "inv_1" },
    fetchOptions: { signal: controller.signal, throw: true },
  });
});

it("throws when the queryFn runs without an invitationId", () => {
  const options = getInvitationQueryOptions(undefined);
  const controller = new AbortController();
  expect(() =>
    options.queryFn?.({
      queryKey: options.queryKey,
      signal: controller.signal,
      meta: undefined,
      client: undefined as never,
    }),
  ).toThrow("invitationId is required");
});
