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
  asc: (col: unknown) => col,
};

vi.mock("~/lib/pg-database", () => ({
  pgDatabase: {
    query: {
      rule: {
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

const { list, get, create, update, remove } = await import("~/lib/router/rule");

const verifiedUser = {
  id: "u_1",
  name: "Ada",
  email: "ada@example.com",
  emailVerified: true,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sampleRule = {
  id: "rule-1",
  houseId: "house-1",
  title: "Use Bun APIs",
  body: "Prefer Bun over Node",
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
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

it("list returns rules scoped to the house", async () => {
  findMany.mockResolvedValueOnce([sampleRule]);
  const result = await call(list, undefined, {
    context: { headers: new Headers() },
  });
  expect(result).toStrictEqual([sampleRule]);
});

it("get returns the matching rule", async () => {
  findFirst.mockResolvedValueOnce(sampleRule);
  const result = await call(
    get,
    { id: "rule-1" },
    { context: { headers: new Headers() } },
  );
  expect(result).toStrictEqual(sampleRule);
});

it("get throws NOT_FOUND when the rule is missing", async () => {
  findFirst.mockResolvedValueOnce(undefined);
  await expect(
    call(get, { id: "x" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("create persists a rule with default enabled=true", async () => {
  insertReturning.mockResolvedValueOnce([sampleRule]);
  const result = await call(
    create,
    { title: "Use Bun APIs", body: "Prefer Bun over Node" },
    { context: { headers: new Headers() } },
  );
  expect(result).toStrictEqual(sampleRule);
});

it("create persists a rule with explicit enabled flag", async () => {
  insertReturning.mockResolvedValueOnce([{ ...sampleRule, enabled: false }]);
  await call(
    create,
    { title: "Foo", body: "Bar", enabled: false },
    { context: { headers: new Headers() } },
  );
  expect(insertReturning).toHaveBeenCalled();
});

it("create throws INTERNAL_SERVER_ERROR when insertion returns no row", async () => {
  insertReturning.mockResolvedValueOnce([]);
  await expect(
    call(
      create,
      { title: "X", body: "Y" },
      { context: { headers: new Headers() } },
    ),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("update toggles the enabled flag", async () => {
  updateReturning.mockResolvedValueOnce([{ ...sampleRule, enabled: false }]);
  const result = await call(
    update,
    { id: "rule-1", enabled: false },
    { context: { headers: new Headers() } },
  );
  expect(result.enabled).toBe(false);
});

it("update throws NOT_FOUND when no row matches", async () => {
  updateReturning.mockResolvedValueOnce([]);
  await expect(
    call(update, { id: "missing" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("remove deletes the rule scoped to the house", async () => {
  deleteReturning.mockResolvedValueOnce([{ id: "rule-1" }]);
  const result = await call(
    remove,
    { id: "rule-1" },
    { context: { headers: new Headers() } },
  );
  expect(result).toBe(true);
});

it("remove throws NOT_FOUND when the rule is missing", async () => {
  deleteReturning.mockResolvedValueOnce([]);
  await expect(
    call(remove, { id: "x" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("create rejects when requireMutatorAccess throws", async () => {
  requireMutatorAccess.mockRejectedValueOnce(new ORPCError("FORBIDDEN"));
  await expect(
    call(
      create,
      { title: "x", body: "y" },
      { context: { headers: new Headers() } },
    ),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("update rejects when requireMutatorAccess throws", async () => {
  requireMutatorAccess.mockRejectedValueOnce(new ORPCError("FORBIDDEN"));
  await expect(
    call(
      update,
      { id: "r1", title: "x" },
      { context: { headers: new Headers() } },
    ),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("remove rejects when requireMutatorAccess throws", async () => {
  requireMutatorAccess.mockRejectedValueOnce(new ORPCError("FORBIDDEN"));
  await expect(
    call(remove, { id: "r1" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});
