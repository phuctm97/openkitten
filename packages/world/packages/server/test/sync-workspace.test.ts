import { beforeEach, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  findFirstWorkspace: vi.fn(),
  findFirstHouse: vi.fn(),
  findFirstHouseMember: vi.fn(),
  insertWorkspace: vi.fn(),
  insertWorkspaceReturning: vi.fn(),
  insertHouse: vi.fn(),
  insertMember: vi.fn(),
  transactionRunner: vi.fn(),
}));

const tableNames = vi.hoisted(() => ({
  workspace: { _: { name: "workspace" } },
  house: { _: { name: "house" } },
  house_member: { _: { name: "house_member" } },
}));

const stubTable = {
  userId: "_",
  house_id: "_",
  id: "_",
  status: "_",
  houseId: "_",
  createdAt: "_",
};
const stubOps = {
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => [a, b],
  asc: (a: unknown) => a,
};

interface FindFirstArgs {
  where?: (t: unknown, o: unknown) => unknown;
  orderBy?: (t: unknown, o: unknown) => unknown;
  with?: Record<string, { where?: (t: unknown, o: unknown) => unknown }>;
}

function exerciseFindFirstCallbacks(args: FindFirstArgs) {
  args.where?.(stubTable, stubOps);
  args.orderBy?.(stubTable, stubOps);
  if (args.with) {
    for (const rel of Object.values(args.with)) {
      rel.where?.(stubTable, stubOps);
    }
  }
}

vi.mock("~/lib/pg-database", () => {
  const buildInsert = (table: { _: { name: string } }) => ({
    values: (values: unknown) => {
      if (table._.name === "house") {
        dbMocks.insertHouse(values);
        return Promise.resolve();
      }
      if (table._.name === "house_member") {
        dbMocks.insertMember(values);
        return Promise.resolve();
      }
      return {
        onConflictDoNothing: () => {
          dbMocks.insertWorkspace(values);
          const returningResult = {
            returning: () =>
              Promise.resolve(dbMocks.insertWorkspaceReturning()),
          };
          return Object.assign(Promise.resolve(), returningResult);
        },
      };
    },
  });
  const tx = { insert: buildInsert };
  const wrap =
    (mock: (args: FindFirstArgs) => unknown) => async (args: FindFirstArgs) => {
      exerciseFindFirstCallbacks(args);
      return mock(args);
    };
  return {
    pgDatabase: {
      query: {
        workspace: { findFirst: wrap(dbMocks.findFirstWorkspace) },
        house: { findFirst: wrap(dbMocks.findFirstHouse) },
        house_member: { findFirst: wrap(dbMocks.findFirstHouseMember) },
      },
      insert: buildInsert,
      transaction: (
        fn: (transaction: { insert: typeof buildInsert }) => Promise<unknown>,
      ) => dbMocks.transactionRunner(fn, tx),
    },
  };
});

vi.mock("~/lib/schema/app", () => ({ workspace: tableNames.workspace }));
vi.mock("~/lib/schema/auth", () => ({
  house: tableNames.house,
  house_member: tableNames.house_member,
}));

vi.mock("~/lib/generate-house-slug", () => ({
  generateHouseSlug: () => "ada-1",
}));

const { syncWorkspace } = await import("~/lib/sync-workspace");
const { WorkspaceNotFoundError } = await import(
  "~/lib/workspace-not-found-error"
);

const ada = { id: "u_1", name: "Ada" };

beforeEach(() => {
  dbMocks.findFirstWorkspace.mockReset();
  dbMocks.findFirstHouse.mockReset();
  dbMocks.findFirstHouseMember.mockReset();
  dbMocks.insertWorkspace.mockReset();
  dbMocks.insertWorkspaceReturning.mockReset();
  dbMocks.insertWorkspaceReturning.mockReturnValue([{ houseId: "house_new" }]);
  dbMocks.insertHouse.mockReset();
  dbMocks.insertMember.mockReset();
  dbMocks.transactionRunner.mockReset();
  dbMocks.transactionRunner.mockImplementation(async (fn, tx) => fn(tx));
});

const baseHouseMember = {
  id: "m_1",
  userId: "u_1",
  role: "owner" as const,
  createdAt: new Date("2026-04-28T00:00:00Z"),
  user: {
    id: "u_1",
    name: "Ada",
    email: "ada@example.com",
    image: null,
  },
};

const houseRow = {
  id: "house_1",
  name: "Ada's House",
  slug: "ada",
  logo: null,
  metadata: null,
  createdAt: new Date("2026-04-28T00:00:00Z"),
  workspace: {
    id: 1,
    userId: "u_1",
    houseId: "house_1",
    createdAt: new Date("2026-04-28T00:00:00Z"),
    updatedAt: new Date("2026-04-28T00:00:00Z"),
  },
  house_members: [baseHouseMember],
  house_invitations: [],
};

it("returns existing personal workspace when no active org id is provided", async () => {
  dbMocks.findFirstWorkspace.mockResolvedValueOnce({ houseId: "house_1" });
  dbMocks.findFirstHouse.mockResolvedValueOnce(houseRow);

  const result = await syncWorkspace({ user: ada });

  expect(result.workspace.isPersonal).toBe(true);
  expect(result.house.id).toBe("house_1");
  expect(result.activeMember.role).toBe("owner");
  expect(dbMocks.insertHouse).not.toHaveBeenCalled();
});

it("returns the active organization when the user is a member and ensures workspace exists", async () => {
  dbMocks.findFirstHouseMember.mockResolvedValueOnce({ id: "m_1" });
  dbMocks.findFirstHouse.mockResolvedValueOnce({
    ...houseRow,
    workspace: { ...houseRow.workspace, userId: null },
    house_members: [{ ...baseHouseMember, role: "admin" }],
  });

  const result = await syncWorkspace({
    user: ada,
    activeOrganizationId: "house_1",
  });

  expect(result.workspace.isPersonal).toBe(false);
  expect(result.activeMember.role).toBe("admin");
  expect(dbMocks.insertWorkspace).toHaveBeenCalledWith({
    houseId: "house_1",
    userId: null,
  });
});

it("falls back to the user's first house membership when no active org and no personal workspace", async () => {
  dbMocks.findFirstWorkspace.mockResolvedValueOnce(undefined);
  dbMocks.findFirstHouseMember.mockResolvedValueOnce({ house_id: "house_2" });
  dbMocks.findFirstHouse.mockResolvedValueOnce({
    ...houseRow,
    id: "house_2",
    workspace: { ...houseRow.workspace, userId: null, houseId: "house_2" },
  });

  const result = await syncWorkspace({ user: ada });

  expect(result.house.id).toBe("house_2");
  expect(result.workspace.isPersonal).toBe(false);
  expect(dbMocks.insertWorkspace).toHaveBeenCalledWith({
    houseId: "house_2",
    userId: null,
  });
});

it("creates a personal house and workspace when the user has no membership", async () => {
  dbMocks.findFirstWorkspace.mockResolvedValueOnce(undefined);
  dbMocks.findFirstHouseMember.mockResolvedValueOnce(undefined);
  dbMocks.findFirstHouse.mockResolvedValueOnce(houseRow);

  await syncWorkspace({ user: ada });

  expect(dbMocks.transactionRunner).toHaveBeenCalled();
  expect(dbMocks.insertHouse).toHaveBeenCalledWith(
    expect.objectContaining({ name: "Ada's House", slug: "ada-1" }),
  );
  expect(dbMocks.insertMember).toHaveBeenCalledWith(
    expect.objectContaining({ userId: "u_1", role: "owner" }),
  );
  expect(dbMocks.insertWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({ userId: "u_1" }),
  );
});

it("rethrows non-auto-create errors raised inside resolveHouseId", async () => {
  const dbDown = new Error("db down");
  dbMocks.findFirstWorkspace.mockRejectedValueOnce(dbDown);
  await expect(syncWorkspace({ user: ada })).rejects.toBe(dbDown);
});

it("retries resolveHouseId when the personal workspace insert loses a race", async () => {
  dbMocks.findFirstWorkspace
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce({ houseId: "house_existing" });
  dbMocks.findFirstHouseMember.mockResolvedValueOnce(undefined);
  dbMocks.findFirstHouse.mockResolvedValueOnce(houseRow);
  dbMocks.insertWorkspaceReturning.mockReturnValueOnce([]);

  const result = await syncWorkspace({ user: ada });

  expect(result.house.id).toBe("house_1");
  expect(dbMocks.findFirstWorkspace).toHaveBeenCalledTimes(2);
});

it("uses 'My House' when the user's name is empty", async () => {
  const anonHouseRow = {
    ...houseRow,
    name: "My House",
    workspace: { ...houseRow.workspace, userId: "u_anon" },
    house_members: [
      {
        ...baseHouseMember,
        userId: "u_anon",
        user: { ...baseHouseMember.user, id: "u_anon" },
      },
    ],
  };
  dbMocks.findFirstWorkspace.mockResolvedValueOnce(undefined);
  dbMocks.findFirstHouseMember.mockResolvedValueOnce(undefined);
  dbMocks.findFirstHouse.mockResolvedValueOnce(anonHouseRow);

  await syncWorkspace({ user: { id: "u_anon", name: "" } });

  expect(dbMocks.insertHouse).toHaveBeenCalledWith(
    expect.objectContaining({ name: "My House" }),
  );
});

it("falls through to the personal-workspace branch when active org id is set but user is not a member", async () => {
  dbMocks.findFirstHouseMember.mockResolvedValueOnce(undefined);
  dbMocks.findFirstWorkspace.mockResolvedValueOnce({ houseId: "house_1" });
  dbMocks.findFirstHouse.mockResolvedValueOnce(houseRow);

  const result = await syncWorkspace({
    user: ada,
    activeOrganizationId: "stale_org",
  });

  expect(result.house.id).toBe("house_1");
});

it("throws WorkspaceNotFoundError(house-missing) when the house is gone", async () => {
  dbMocks.findFirstWorkspace.mockResolvedValueOnce({ houseId: "house_x" });
  dbMocks.findFirstHouse.mockResolvedValueOnce(undefined);

  const error = await syncWorkspace({ user: ada }).catch((e) => e);
  expect(error).toBeInstanceOf(WorkspaceNotFoundError);
  expect(error.reason).toBe("house-missing");
});

it("throws WorkspaceNotFoundError(workspace-missing) when the workspace row is gone", async () => {
  dbMocks.findFirstWorkspace.mockResolvedValueOnce({ houseId: "house_1" });
  dbMocks.findFirstHouse.mockResolvedValueOnce({
    ...houseRow,
    workspace: undefined,
  });

  const error = await syncWorkspace({ user: ada }).catch((e) => e);
  expect(error).toBeInstanceOf(WorkspaceNotFoundError);
  expect(error.reason).toBe("workspace-missing");
});

it("maps pending house invitations into the result", async () => {
  dbMocks.findFirstWorkspace.mockResolvedValueOnce({ houseId: "house_1" });
  const expiresAt = new Date("2026-05-01T00:00:00Z");
  dbMocks.findFirstHouse.mockResolvedValueOnce({
    ...houseRow,
    house_invitations: [
      {
        id: "inv_1",
        email: "bob@example.com",
        role: "member",
        status: "pending",
        expiresAt,
      },
    ],
  });

  const result = await syncWorkspace({ user: ada });

  expect(result.invitations).toStrictEqual([
    {
      id: "inv_1",
      email: "bob@example.com",
      role: "member",
      status: "pending",
      expiresAt,
    },
  ]);
});

it("throws WorkspaceNotFoundError(membership-missing) when the user is not in the resolved house members", async () => {
  dbMocks.findFirstWorkspace.mockResolvedValueOnce({ houseId: "house_1" });
  dbMocks.findFirstHouse.mockResolvedValueOnce({
    ...houseRow,
    house_members: [
      {
        ...baseHouseMember,
        userId: "u_other",
        user: { ...baseHouseMember.user, id: "u_other" },
      },
    ],
  });

  const error = await syncWorkspace({ user: ada }).catch((e) => e);
  expect(error).toBeInstanceOf(WorkspaceNotFoundError);
  expect(error.reason).toBe("membership-missing");
});
