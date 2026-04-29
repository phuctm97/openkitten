import { call, ORPCError } from "@orpc/server";
import { beforeEach, expect, it, vi } from "vitest";

const { getSession, requireActiveHouse, requireMutatorAccess } = vi.hoisted(
  () => ({
    getSession: vi.fn(),
    requireActiveHouse: vi.fn(),
    requireMutatorAccess: vi.fn(),
  }),
);

const findMany = vi.fn();
const findFirst = vi.fn();
const insertReturning = vi.fn();
const updateReturning = vi.fn();
const deleteReturning = vi.fn();

vi.mock("~/lib/auth", () => ({
  auth: {
    api: { getSession },
    options: { basePath: "/auth", trustedOrigins: [] },
    handler: vi.fn(),
  },
}));

vi.mock("~/lib/require-active-house", () => ({ requireActiveHouse }));
vi.mock("~/lib/require-mutator-access", () => ({ requireMutatorAccess }));

const stubTable = { houseId: "_", id: "_", createdAt: "_" };
const stubOps = {
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => [a, b],
  desc: (col: unknown) => col,
};

vi.mock("~/lib/pg-database", () => ({
  pgDatabase: {
    query: {
      goal: {
        findMany: async (args: {
          where: (t: unknown, o: unknown) => unknown;
          orderBy: (t: unknown, o: unknown) => unknown;
        }) => {
          args.where(stubTable, stubOps);
          args.orderBy(stubTable, stubOps);
          return findMany(args);
        },
        findFirst: async (args: {
          where: (t: unknown, o: unknown) => unknown;
        }) => {
          args.where(stubTable, stubOps);
          return findFirst(args);
        },
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: insertReturning })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: updateReturning })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({ returning: deleteReturning })),
    })),
  },
}));

const { list, get, create, update, remove } = await import("~/lib/router/goal");

const verifiedUser = {
  id: "u_1",
  name: "Ada",
  email: "ada@example.com",
  emailVerified: true,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sampleGoal = {
  id: "goal-1",
  houseId: "house-1",
  title: "Ship v1",
  description: null,
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
  achievedAt: null,
};

beforeEach(() => {
  getSession.mockReset();
  requireActiveHouse.mockReset();
  requireMutatorAccess.mockReset();
  findMany.mockReset();
  findFirst.mockReset();
  insertReturning.mockReset();
  updateReturning.mockReset();
  deleteReturning.mockReset();
  getSession.mockResolvedValue({ user: verifiedUser });
  requireActiveHouse.mockResolvedValue("house-1");
  requireMutatorAccess.mockResolvedValue("house-1");
});

it("list returns goals scoped to the active house", async () => {
  findMany.mockResolvedValueOnce([sampleGoal]);
  const result = await call(list, undefined, {
    context: { headers: new Headers() },
  });
  expect(result).toStrictEqual([sampleGoal]);
});

it("get returns the matching goal", async () => {
  findFirst.mockResolvedValueOnce(sampleGoal);
  const result = await call(
    get,
    { id: "goal-1" },
    { context: { headers: new Headers() } },
  );
  expect(result).toStrictEqual(sampleGoal);
});

it("get throws NOT_FOUND when the goal is missing", async () => {
  findFirst.mockResolvedValueOnce(undefined);
  await expect(
    call(get, { id: "x" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("create persists a goal with optional description and status", async () => {
  insertReturning.mockResolvedValueOnce([sampleGoal]);
  const result = await call(
    create,
    { title: "Ship v1", description: "Q2", status: "active" },
    { context: { headers: new Headers() } },
  );
  expect(result).toStrictEqual(sampleGoal);
});

it("create defaults description to null and status to active", async () => {
  insertReturning.mockResolvedValueOnce([sampleGoal]);
  await call(
    create,
    { title: "Ship v1" },
    { context: { headers: new Headers() } },
  );
  expect(insertReturning).toHaveBeenCalled();
});

it("create throws INTERNAL_SERVER_ERROR when insertion returns no row", async () => {
  insertReturning.mockResolvedValueOnce([]);
  await expect(
    call(create, { title: "Ship v1" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("update writes goal status and achievedAt", async () => {
  updateReturning.mockResolvedValueOnce([
    { ...sampleGoal, status: "achieved", achievedAt: new Date() },
  ]);
  const result = await call(
    update,
    { id: "goal-1", status: "achieved", achievedAt: new Date() },
    { context: { headers: new Headers() } },
  );
  expect(result.status).toBe("achieved");
});

it("update throws NOT_FOUND when no row matches", async () => {
  updateReturning.mockResolvedValueOnce([]);
  await expect(
    call(
      update,
      { id: "missing", title: "X" },
      { context: { headers: new Headers() } },
    ),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("remove deletes the goal scoped to the house", async () => {
  deleteReturning.mockResolvedValueOnce([{ id: "goal-1" }]);
  const result = await call(
    remove,
    { id: "goal-1" },
    { context: { headers: new Headers() } },
  );
  expect(result).toBe(true);
});

it("remove throws NOT_FOUND when the goal is missing", async () => {
  deleteReturning.mockResolvedValueOnce([]);
  await expect(
    call(remove, { id: "x" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("create rejects when requireMutatorAccess throws (member role)", async () => {
  requireMutatorAccess.mockRejectedValueOnce(
    new ORPCError("FORBIDDEN", { message: "Members cannot create goals" }),
  );
  await expect(
    call(create, { title: "x" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
  expect(insertReturning).not.toHaveBeenCalled();
});

it("update and remove reject when requireMutatorAccess throws", async () => {
  requireMutatorAccess.mockRejectedValueOnce(new ORPCError("FORBIDDEN"));
  await expect(
    call(
      update,
      { id: "g1", title: "x" },
      { context: { headers: new Headers() } },
    ),
  ).rejects.toBeInstanceOf(ORPCError);
  requireMutatorAccess.mockRejectedValueOnce(new ORPCError("FORBIDDEN"));
  await expect(
    call(remove, { id: "g1" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});
