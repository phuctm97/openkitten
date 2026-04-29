import { call, ORPCError } from "@orpc/server";
import { beforeEach, expect, it, vi } from "vitest";

const { getSession, syncWorkspace, findFirstMember } = vi.hoisted(() => ({
  getSession: vi.fn(),
  syncWorkspace: vi.fn(),
  findFirstMember: vi.fn(),
}));

vi.mock("~/lib/auth", () => ({
  auth: {
    api: { getSession },
    options: { basePath: "/auth", trustedOrigins: [] },
    handler: vi.fn(),
  },
}));

const stubTable = { userId: "_", house_id: "_" };
const stubOps = {
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => [a, b],
};

vi.mock("~/lib/pg-database", () => ({
  pgDatabase: {
    query: {
      house_member: {
        findFirst: async (args: {
          where?: (t: unknown, o: unknown) => unknown;
          with?: Record<
            string,
            { where?: (t: unknown, o: unknown) => unknown }
          >;
        }) => {
          args.where?.(stubTable, stubOps);
          if (args.with) {
            for (const rel of Object.values(args.with)) {
              rel.where?.(stubTable, stubOps);
            }
          }
          return findFirstMember(args);
        },
      },
    },
  },
}));

vi.mock("~/lib/sync-workspace", () => ({ syncWorkspace }));

const { workspaceSync } = await import("~/lib/router/workspace");
const { WorkspaceNotFoundError } = await import(
  "~/lib/workspace-not-found-error"
);

beforeEach(() => {
  getSession.mockReset();
  syncWorkspace.mockReset();
  findFirstMember.mockReset();
});

const verifiedUser = {
  id: "u_1",
  name: "Ada",
  email: "ada@example.com",
  emailVerified: true,
  image: null,
  createdAt: new Date("2026-04-28T00:00:00Z"),
  updatedAt: new Date("2026-04-28T00:00:00Z"),
};

const fullWorkspace = {
  workspace: {
    id: 1,
    userId: "u_1",
    houseId: "house_1",
    isPersonal: true,
    createdAt: new Date("2026-04-28T00:00:00Z"),
    updatedAt: new Date("2026-04-28T00:00:00Z"),
  },
  house: {
    id: "house_1",
    name: "Ada's House",
    slug: "ada-house",
    logo: null,
    metadata: null,
    createdAt: new Date("2026-04-28T00:00:00Z"),
  },
  members: [],
  invitations: [],
  activeMember: {
    id: "m_1",
    role: "owner" as const,
    createdAt: new Date("2026-04-28T00:00:00Z"),
  },
};

it("returns the full workspace when no active organization is set", async () => {
  getSession.mockResolvedValueOnce({ user: verifiedUser });
  syncWorkspace.mockResolvedValueOnce(fullWorkspace);

  const result = await call(workspaceSync, undefined, {
    context: { headers: new Headers() },
  });

  expect(result).toStrictEqual(fullWorkspace);
  expect(syncWorkspace).toHaveBeenCalledWith({ user: verifiedUser });
});

it("returns the full workspace when the active organization header is set and the user is a member", async () => {
  getSession.mockResolvedValueOnce({ user: verifiedUser });
  findFirstMember.mockResolvedValueOnce({
    house_id: "house_1",
    role: "owner",
    createdAt: new Date("2026-04-28T00:00:00Z"),
    house: { workspace: { userId: null } },
  });
  syncWorkspace.mockResolvedValueOnce(fullWorkspace);

  const headers = new Headers({ "x-active-organization-id": "house_1" });
  const result = await call(workspaceSync, undefined, {
    context: { headers },
  });

  expect(result).toStrictEqual(fullWorkspace);
  expect(syncWorkspace).toHaveBeenCalledWith({
    user: verifiedUser,
    activeOrganizationId: "house_1",
  });
});

it("rejects with INTERNAL_SERVER_ERROR when the resolved house is missing its workspace row", async () => {
  getSession.mockResolvedValueOnce({ user: verifiedUser });
  findFirstMember.mockResolvedValueOnce({
    house_id: "house_1",
    role: "owner",
    createdAt: new Date("2026-04-28T00:00:00Z"),
    house: { workspace: undefined },
  });

  const headers = new Headers({ "x-active-organization-id": "house_1" });
  await expect(
    call(workspaceSync, undefined, { context: { headers } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("falls back to no-active-organization when a stale header points to a non-membership", async () => {
  getSession.mockResolvedValueOnce({ user: verifiedUser });
  findFirstMember.mockResolvedValueOnce(undefined);
  syncWorkspace.mockResolvedValueOnce(fullWorkspace);

  const headers = new Headers({ "x-active-organization-id": "stale_org" });
  await call(workspaceSync, undefined, { context: { headers } });

  expect(syncWorkspace).toHaveBeenCalledWith({ user: verifiedUser });
});

it("ignores an empty x-active-organization-id header", async () => {
  getSession.mockResolvedValueOnce({ user: verifiedUser });
  syncWorkspace.mockResolvedValueOnce(fullWorkspace);

  const headers = new Headers({ "x-active-organization-id": "" });
  await call(workspaceSync, undefined, { context: { headers } });

  expect(findFirstMember).not.toHaveBeenCalled();
  expect(syncWorkspace).toHaveBeenCalledWith({ user: verifiedUser });
});

it("translates WorkspaceNotFoundError into a NOT_FOUND ORPCError", async () => {
  getSession.mockResolvedValueOnce({ user: verifiedUser });
  syncWorkspace.mockRejectedValueOnce(new WorkspaceNotFoundError());

  await expect(
    call(workspaceSync, undefined, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("rethrows unexpected errors raised inside syncWorkspace", async () => {
  getSession.mockResolvedValueOnce({ user: verifiedUser });
  const unexpected = new Error("boom");
  syncWorkspace.mockRejectedValueOnce(unexpected);

  await expect(
    call(workspaceSync, undefined, { context: { headers: new Headers() } }),
  ).rejects.toBe(unexpected);
});

it("rejects when no session is present", async () => {
  getSession.mockResolvedValueOnce(null);

  await expect(
    call(workspaceSync, undefined, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("rejects when the user has not verified their email", async () => {
  getSession.mockResolvedValueOnce({
    user: { ...verifiedUser, emailVerified: false },
  });

  await expect(
    call(workspaceSync, undefined, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});
