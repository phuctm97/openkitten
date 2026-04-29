import { beforeEach, expect, it, vi } from "vitest";

const queryClientMock = vi.hoisted(() => ({
  setMutationDefaults: vi.fn(),
  setQueryDefaults: vi.fn(),
}));

const authClientMock = vi.hoisted(() => ({
  organization: {
    list: vi.fn(),
    getFullOrganization: vi.fn(),
  },
}));

const orpcUtilsMock = vi.hoisted(() => ({
  workspace: {
    sync: {
      queryOptions: vi.fn(() => ({
        queryKey: [["workspace", "sync"], { type: "query" }],
        queryFn: vi.fn(),
      })),
    },
  },
}));

const factoryReturns = vi.hoisted(() => ({
  create: { mutationKey: ["organizations", "create"], mutationFn: vi.fn() },
  delete: {
    mutationKey: ["active-organization", "delete"],
    mutationFn: vi.fn(),
  },
  setActive: {
    mutationKey: ["active-organization", "setActive"],
    mutationFn: vi.fn(),
  },
  update: {
    mutationKey: ["active-organization", "update"],
    mutationFn: vi.fn(),
  },
  inviteMember: {
    mutationKey: ["active-organization", "inviteMember"],
    mutationFn: vi.fn(),
  },
  removeMember: {
    mutationKey: ["active-organization", "removeMember"],
    mutationFn: vi.fn(),
  },
  updateMemberRole: {
    mutationKey: ["active-organization", "updateMemberRole"],
    mutationFn: vi.fn(),
  },
  cancelInvitation: {
    mutationKey: ["active-organization", "cancelInvitation"],
    mutationFn: vi.fn(),
  },
  acceptInvitation: {
    mutationKey: ["active-organization", "acceptInvitation"],
    mutationFn: vi.fn(),
  },
  rejectInvitation: {
    mutationKey: ["active-organization", "rejectInvitation"],
    mutationFn: vi.fn(),
  },
  leave: {
    mutationKey: ["active-organization", "leave"],
    mutationFn: vi.fn(),
  },
  withoutKey: { mutationFn: vi.fn() },
}));

const orgMutationOptionsMock = vi.hoisted(() => ({
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
}));

vi.mock("~/lib/query-client", () => ({ queryClient: queryClientMock }));
vi.mock("~/lib/auth-client", () => ({ authClient: authClientMock }));
vi.mock("~/lib/orpc-utils", () => ({ orpcUtils: orpcUtilsMock }));
vi.mock("~/lib/org-mutation-options", () => ({
  orgMutationOptions: orgMutationOptionsMock,
}));
vi.mock("~/lib/org-query-keys", () => ({
  orgQueryKeys: {
    all: ["organizations"],
    list: ["organizations", "list"],
    full: ["organizations", "full"],
    members: ["organizations", "members"],
    invitations: ["organizations", "invitations"],
    invitation: ["organizations", "invitation"],
  },
}));

const orgMutationKeys = [
  "create",
  "delete",
  "setActive",
  "update",
  "inviteMember",
  "removeMember",
  "updateMemberRole",
  "cancelInvitation",
  "acceptInvitation",
  "rejectInvitation",
  "leave",
] as const;

beforeEach(() => {
  queryClientMock.setMutationDefaults.mockClear();
  queryClientMock.setQueryDefaults.mockClear();
  authClientMock.organization.list.mockReset();
  authClientMock.organization.getFullOrganization.mockReset();
  for (const key of orgMutationKeys) {
    orgMutationOptionsMock[key].mockReset();
    orgMutationOptionsMock[key].mockReturnValue(factoryReturns[key]);
  }
  vi.resetModules();
});

it("slices the orpc workspace.sync queryKey to its path before registering query defaults", async () => {
  const { applyDefaults } = await import("~/lib/apply-defaults");
  applyDefaults();

  expect(queryClientMock.setQueryDefaults).toHaveBeenCalledWith(
    [["workspace", "sync"]],
    expect.objectContaining({
      queryKey: [["workspace", "sync"], { type: "query" }],
    }),
  );
});

it("keeps a single-segment orpc queryKey intact when registering query defaults", async () => {
  orpcUtilsMock.workspace.sync.queryOptions.mockReturnValueOnce({
    queryKey: [["workspace", "sync"]],
    queryFn: vi.fn(),
  } as never);

  const { applyDefaults } = await import("~/lib/apply-defaults");
  applyDefaults();

  expect(queryClientMock.setQueryDefaults).toHaveBeenCalledWith(
    [["workspace", "sync"]],
    expect.objectContaining({ queryKey: [["workspace", "sync"]] }),
  );
});

it("registers a mutation default for every better-auth organization mutation", async () => {
  const { applyDefaults } = await import("~/lib/apply-defaults");
  applyDefaults();

  expect(queryClientMock.setMutationDefaults).toHaveBeenCalledTimes(
    orgMutationKeys.length,
  );
  for (const key of orgMutationKeys) {
    const expected = factoryReturns[key];
    expect(queryClientMock.setMutationDefaults).toHaveBeenCalledWith(
      expected.mutationKey,
      expected,
    );
  }
});

it("registers a default queryFn for the organizations list scope", async () => {
  const { applyDefaults } = await import("~/lib/apply-defaults");
  applyDefaults();

  const call = queryClientMock.setQueryDefaults.mock.calls.find(
    ([key]) =>
      Array.isArray(key) &&
      key.length === 2 &&
      key[0] === "organizations" &&
      key[1] === "list",
  );
  expect(call).toBeDefined();

  const controller = new AbortController();
  authClientMock.organization.list.mockResolvedValueOnce("orgs" as never);
  await call?.[1].queryFn?.({ signal: controller.signal });
  expect(authClientMock.organization.list).toHaveBeenCalledWith({
    fetchOptions: { signal: controller.signal, throw: true },
  });
});

it("does not register a default queryFn for any other organization scope", async () => {
  const { applyDefaults } = await import("~/lib/apply-defaults");
  applyDefaults();

  for (const [key] of queryClientMock.setQueryDefaults.mock.calls) {
    if (!Array.isArray(key) || key[0] !== "organizations") continue;
    expect(key).toStrictEqual(["organizations", "list"]);
  }
});

it("skips registering a mutation default when the factory returns no mutation key", async () => {
  orgMutationOptionsMock.create.mockReturnValueOnce(
    factoryReturns.withoutKey as never,
  );

  const { applyDefaults } = await import("~/lib/apply-defaults");
  applyDefaults();

  expect(queryClientMock.setMutationDefaults).toHaveBeenCalledTimes(
    orgMutationKeys.length - 1,
  );
  expect(queryClientMock.setMutationDefaults).not.toHaveBeenCalledWith(
    undefined,
    expect.anything(),
  );
  expect(queryClientMock.setMutationDefaults).not.toHaveBeenCalledWith(
    expect.anything(),
    factoryReturns.withoutKey,
  );
});

it("skips registering a query default when the orpc options have no query key", async () => {
  orpcUtilsMock.workspace.sync.queryOptions.mockReturnValueOnce({
    queryFn: vi.fn(),
  } as never);

  const { applyDefaults } = await import("~/lib/apply-defaults");
  applyDefaults();

  const workspaceCall = queryClientMock.setQueryDefaults.mock.calls.find(
    ([key]) =>
      Array.isArray(key) &&
      key.length === 1 &&
      Array.isArray(key[0]) &&
      key[0][0] === "workspace",
  );
  expect(workspaceCall).toBeUndefined();
});
