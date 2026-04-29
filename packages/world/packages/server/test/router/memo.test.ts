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

const stubTable = {
  houseId: "_",
  id: "_",
  pinnedAt: "_",
  createdAt: "_",
  targetCatId: "_",
};
const stubOps = {
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => [a, b],
  desc: (col: unknown) => col,
};

vi.mock("~/lib/pg-database", () => ({
  pgDatabase: {
    query: {
      memo: {
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

const { list, get, create, update, pin, unpin, remove } = await import(
  "~/lib/router/memo"
);

const verifiedUser = {
  id: "u_1",
  name: "Ada",
  email: "ada@example.com",
  emailVerified: true,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sampleMemo = {
  id: "memo-1",
  houseId: "house-1",
  authorUserId: "u_1",
  targetCatId: null,
  body: "Be calm",
  pinnedAt: null,
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

it("list returns all memos when no filter is set", async () => {
  findMany.mockResolvedValueOnce([sampleMemo]);
  const result = await call(list, undefined, {
    context: { headers: new Headers() },
  });
  expect(result).toStrictEqual([sampleMemo]);
});

it("list filters by targetCatId when provided", async () => {
  findMany.mockResolvedValueOnce([sampleMemo]);
  await call(
    list,
    { targetCatId: "cat-1" },
    { context: { headers: new Headers() } },
  );
  expect(findMany).toHaveBeenCalled();
});

it("get returns the matching memo", async () => {
  findFirst.mockResolvedValueOnce(sampleMemo);
  const result = await call(
    get,
    { id: "memo-1" },
    { context: { headers: new Headers() } },
  );
  expect(result).toStrictEqual(sampleMemo);
});

it("get throws NOT_FOUND when the memo is missing", async () => {
  findFirst.mockResolvedValueOnce(undefined);
  await expect(
    call(get, { id: "x" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("create persists a memo authored by the active user", async () => {
  insertReturning.mockResolvedValueOnce([sampleMemo]);
  const result = await call(
    create,
    { body: "Be calm", targetCatId: "cat-1" },
    { context: { headers: new Headers() } },
  );
  expect(result).toStrictEqual(sampleMemo);
});

it("create defaults targetCatId to null", async () => {
  insertReturning.mockResolvedValueOnce([sampleMemo]);
  await call(
    create,
    { body: "Be calm" },
    { context: { headers: new Headers() } },
  );
  expect(insertReturning).toHaveBeenCalled();
});

it("create throws INTERNAL_SERVER_ERROR when insertion returns no row", async () => {
  insertReturning.mockResolvedValueOnce([]);
  await expect(
    call(create, { body: "x" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("update writes changes to the memo", async () => {
  updateReturning.mockResolvedValueOnce([{ ...sampleMemo, body: "Updated" }]);
  const result = await call(
    update,
    { id: "memo-1", body: "Updated" },
    { context: { headers: new Headers() } },
  );
  expect(result.body).toBe("Updated");
});

it("update throws NOT_FOUND when no row matches", async () => {
  updateReturning.mockResolvedValueOnce([]);
  await expect(
    call(update, { id: "missing" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("pin stamps pinnedAt and returns the memo", async () => {
  updateReturning.mockResolvedValueOnce([
    { ...sampleMemo, pinnedAt: new Date() },
  ]);
  const result = await call(
    pin,
    { id: "memo-1" },
    { context: { headers: new Headers() } },
  );
  expect(result.pinnedAt).not.toBeNull();
});

it("pin throws NOT_FOUND when no memo matches", async () => {
  updateReturning.mockResolvedValueOnce([]);
  await expect(
    call(pin, { id: "x" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("unpin clears pinnedAt and returns the memo", async () => {
  updateReturning.mockResolvedValueOnce([{ ...sampleMemo, pinnedAt: null }]);
  const result = await call(
    unpin,
    { id: "memo-1" },
    { context: { headers: new Headers() } },
  );
  expect(result.pinnedAt).toBeNull();
});

it("unpin throws NOT_FOUND when no memo matches", async () => {
  updateReturning.mockResolvedValueOnce([]);
  await expect(
    call(unpin, { id: "x" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("remove deletes the memo scoped to the house", async () => {
  deleteReturning.mockResolvedValueOnce([{ id: "memo-1" }]);
  const result = await call(
    remove,
    { id: "memo-1" },
    { context: { headers: new Headers() } },
  );
  expect(result).toBe(true);
});

it("remove throws NOT_FOUND when the memo is missing", async () => {
  deleteReturning.mockResolvedValueOnce([]);
  await expect(
    call(remove, { id: "x" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("create rejects when requireMutatorAccess throws", async () => {
  requireMutatorAccess.mockRejectedValueOnce(new ORPCError("FORBIDDEN"));
  await expect(
    call(create, { body: "x" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("update rejects when requireMutatorAccess throws", async () => {
  requireMutatorAccess.mockRejectedValueOnce(new ORPCError("FORBIDDEN"));
  await expect(
    call(
      update,
      { id: "m1", body: "y" },
      { context: { headers: new Headers() } },
    ),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("pin rejects when requireMutatorAccess throws", async () => {
  requireMutatorAccess.mockRejectedValueOnce(new ORPCError("FORBIDDEN"));
  await expect(
    call(pin, { id: "m1" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("unpin rejects when requireMutatorAccess throws", async () => {
  requireMutatorAccess.mockRejectedValueOnce(new ORPCError("FORBIDDEN"));
  await expect(
    call(unpin, { id: "m1" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("remove rejects when requireMutatorAccess throws", async () => {
  requireMutatorAccess.mockRejectedValueOnce(new ORPCError("FORBIDDEN"));
  await expect(
    call(remove, { id: "m1" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});
