import { expect, it, vi } from "vitest";

const authClientMock = vi.hoisted(() => ({
  organization: {
    getFullOrganization: vi.fn(),
  },
}));

vi.mock("~/lib/auth-client", () => ({ authClient: authClientMock }));

const { getFullOrganizationQueryOptions } = await import(
  "~/lib/get-full-organization-query-options"
);

it("disables the query when no organizationId is provided", () => {
  const options = getFullOrganizationQueryOptions(undefined);
  expect(options.queryKey).toStrictEqual(["organizations", "full", null]);
  expect(options.enabled).toBe(false);
});

it("enables the query and exposes a stable key when an id is provided", () => {
  const options = getFullOrganizationQueryOptions("org_1");
  expect(options.queryKey).toStrictEqual(["organizations", "full", "org_1"]);
  expect(options.enabled).toBe(true);
});

it("delegates to authClient.organization.getFullOrganization with the abort signal", async () => {
  const options = getFullOrganizationQueryOptions("org_1");
  const controller = new AbortController();
  authClientMock.organization.getFullOrganization.mockResolvedValueOnce({
    id: "org_1",
  });

  const result = await options.queryFn?.({
    queryKey: options.queryKey,
    signal: controller.signal,
    meta: undefined,
    client: undefined as never,
  });

  expect(result).toStrictEqual({ id: "org_1" });
  expect(authClientMock.organization.getFullOrganization).toHaveBeenCalledWith({
    query: { organizationId: "org_1" },
    fetchOptions: { signal: controller.signal, throw: true },
  });
});

it("throws when the queryFn runs without an organizationId", () => {
  const options = getFullOrganizationQueryOptions(undefined);
  const controller = new AbortController();
  expect(() =>
    options.queryFn?.({
      queryKey: options.queryKey,
      signal: controller.signal,
      meta: undefined,
      client: undefined as never,
    }),
  ).toThrow("organizationId is required");
});
