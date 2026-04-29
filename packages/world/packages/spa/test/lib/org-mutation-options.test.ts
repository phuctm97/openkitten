import { beforeEach, describe, expect, it, vi } from "vitest";

const authClientMock = vi.hoisted(() => ({
  organization: {
    create: vi.fn(),
    delete: vi.fn(),
    setActive: vi.fn(),
    update: vi.fn(),
    inviteMember: vi.fn(),
    removeMember: vi.fn(),
    updateMemberRole: vi.fn(),
    cancelInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
    rejectInvitation: vi.fn(),
    leave: vi.fn(),
  },
}));

const queryClientMock = vi.hoisted(() => ({
  invalidateQueries: vi.fn<(filters?: { queryKey?: unknown }) => Promise<void>>(
    () => Promise.resolve(),
  ),
}));

vi.mock("~/lib/auth-client", () => ({ authClient: authClientMock }));
vi.mock("~/lib/query-client", () => ({ queryClient: queryClientMock }));

const { orgMutationOptions } = await import("~/lib/org-mutation-options");
const { sessionQueryOptions } = await import("~/lib/session-query-options");

const cases = [
  {
    method: "create" as const,
    expectedKey: ["organizations", "create"],
    input: { name: "Acme", slug: "acme" },
    invalidations: [["organizations", "list"]],
  },
  {
    method: "delete" as const,
    expectedKey: ["active-organization", "delete"],
    input: { organizationId: "org_1" },
    invalidations: [["organizations"]],
  },
  {
    method: "setActive" as const,
    expectedKey: ["active-organization", "setActive"],
    input: { organizationId: "org_1" },
    invalidations: [["organizations"], sessionQueryOptions.queryKey, undefined],
  },
  {
    method: "update" as const,
    expectedKey: ["active-organization", "update"],
    input: { organizationId: "org_1", data: { name: "Acme" } },
    invalidations: [
      ["organizations", "list"],
      ["organizations", "full"],
    ],
  },
  {
    method: "inviteMember" as const,
    expectedKey: ["active-organization", "inviteMember"],
    input: { email: "a@b.com", role: "member", organizationId: "org_1" },
    invalidations: [["organizations", "invitations"]],
  },
  {
    method: "removeMember" as const,
    expectedKey: ["active-organization", "removeMember"],
    input: { memberIdOrEmail: "member_1" },
    invalidations: [["organizations", "members"]],
  },
  {
    method: "updateMemberRole" as const,
    expectedKey: ["active-organization", "updateMemberRole"],
    input: { memberId: "member_1", role: "admin" },
    invalidations: [["organizations", "members"]],
  },
  {
    method: "cancelInvitation" as const,
    expectedKey: ["active-organization", "cancelInvitation"],
    input: { invitationId: "inv_1" },
    invalidations: [["organizations", "invitations"]],
  },
  {
    method: "acceptInvitation" as const,
    expectedKey: ["active-organization", "acceptInvitation"],
    input: { invitationId: "inv_1" },
    invalidations: [
      ["organizations", "list"],
      ["organizations", "invitation"],
    ],
  },
  {
    method: "rejectInvitation" as const,
    expectedKey: ["active-organization", "rejectInvitation"],
    input: { invitationId: "inv_1" },
    invalidations: [["organizations", "invitation"]],
  },
  {
    method: "leave" as const,
    expectedKey: ["active-organization", "leave"],
    input: { organizationId: "org_1" },
    invalidations: [["organizations"]],
  },
];

beforeEach(() => {
  queryClientMock.invalidateQueries.mockClear();
});

describe.each(cases)("$method factory", ({
  method,
  expectedKey,
  input,
  invalidations,
}) => {
  it("uses the canonical mutation key", () => {
    expect(orgMutationOptions[method]().mutationKey).toStrictEqual(expectedKey);
  });

  it("delegates to authClient.organization with throw enabled", async () => {
    const fn = authClientMock.organization[method];
    fn.mockResolvedValueOnce("ok" as never);
    const result = await orgMutationOptions[method]().mutationFn(
      input as never,
    );
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledWith({
      ...input,
      fetchOptions: { throw: true },
    });
  });

  it("invalidates the right scopes from onSettled", async () => {
    await orgMutationOptions[method]().onSettled?.();
    const calls = queryClientMock.invalidateQueries.mock.calls.map(
      ([filters]) => filters?.queryKey,
    );
    expect(calls).toStrictEqual(invalidations);
  });
});
