import { call, ORPCError } from "@orpc/server";
import { beforeEach, expect, it, vi } from "vitest";

const { getSession, requireActiveHouse } = vi.hoisted(() => ({
  getSession: vi.fn(),
  requireActiveHouse: vi.fn(),
}));

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

const stubTable = {
  houseId: "_",
  id: "_",
  status: "_",
  assignedCatId: "_",
  goalId: "_",
  updatedAt: "_",
};
const stubOps = {
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => [a, b],
  desc: (col: unknown) => col,
};

vi.mock("~/lib/pg-database", () => ({
  pgDatabase: {
    query: {
      thread: {
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

const { list, get, create, update, close, reopen, remove } = await import(
  "~/lib/router/thread"
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

const sampleThread = {
  id: "thread-1",
  houseId: "house-1",
  title: "Refactor caching",
  summary: null,
  status: "open",
  assignedCatId: null,
  goalId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  closedAt: null,
};

beforeEach(() => {
  getSession.mockReset();
  requireActiveHouse.mockReset();
  findMany.mockReset();
  findFirst.mockReset();
  insertReturning.mockReset();
  updateReturning.mockReset();
  deleteReturning.mockReset();
  getSession.mockResolvedValue({ user: verifiedUser });
  requireActiveHouse.mockResolvedValue("house-1");
});

it("list returns threads scoped to the house with no filters", async () => {
  findMany.mockResolvedValueOnce([sampleThread]);
  const result = await call(list, undefined, {
    context: { headers: new Headers() },
  });
  expect(result).toStrictEqual([sampleThread]);
});

it("list applies status, assignedCatId, and goalId filters", async () => {
  findMany.mockResolvedValueOnce([sampleThread]);
  await call(
    list,
    { status: "open", assignedCatId: "cat-1", goalId: "goal-1" },
    { context: { headers: new Headers() } },
  );
  expect(findMany).toHaveBeenCalled();
});

it("get returns the matching thread", async () => {
  findFirst.mockResolvedValueOnce(sampleThread);
  const result = await call(
    get,
    { id: "thread-1" },
    { context: { headers: new Headers() } },
  );
  expect(result).toStrictEqual(sampleThread);
});

it("get throws NOT_FOUND when the thread is missing", async () => {
  findFirst.mockResolvedValueOnce(undefined);
  await expect(
    call(get, { id: "x" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("create persists the thread", async () => {
  insertReturning.mockResolvedValueOnce([sampleThread]);
  const result = await call(
    create,
    {
      title: "Refactor caching",
      summary: "Reduce DB load",
      assignedCatId: "cat-1",
      goalId: "goal-1",
    },
    { context: { headers: new Headers() } },
  );
  expect(result).toStrictEqual(sampleThread);
});

it("create throws INTERNAL_SERVER_ERROR when insertion returns no row", async () => {
  insertReturning.mockResolvedValueOnce([]);
  await expect(
    call(create, { title: "X" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("update writes changes to the thread", async () => {
  updateReturning.mockResolvedValueOnce([
    { ...sampleThread, summary: "Updated" },
  ]);
  const result = await call(
    update,
    { id: "thread-1", summary: "Updated" },
    { context: { headers: new Headers() } },
  );
  expect(result.summary).toBe("Updated");
});

it("update throws NOT_FOUND when no row matches", async () => {
  updateReturning.mockResolvedValueOnce([]);
  await expect(
    call(update, { id: "missing" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("close sets status to closed and stamps closedAt", async () => {
  updateReturning.mockResolvedValueOnce([
    { ...sampleThread, status: "closed", closedAt: new Date() },
  ]);
  const result = await call(
    close,
    { id: "thread-1" },
    { context: { headers: new Headers() } },
  );
  expect(result.status).toBe("closed");
});

it("close throws NOT_FOUND when no thread matches", async () => {
  updateReturning.mockResolvedValueOnce([]);
  await expect(
    call(close, { id: "x" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("reopen sets status to open and clears closedAt", async () => {
  updateReturning.mockResolvedValueOnce([
    { ...sampleThread, status: "open", closedAt: null },
  ]);
  const result = await call(
    reopen,
    { id: "thread-1" },
    { context: { headers: new Headers() } },
  );
  expect(result.status).toBe("open");
});

it("reopen throws NOT_FOUND when no thread matches", async () => {
  updateReturning.mockResolvedValueOnce([]);
  await expect(
    call(reopen, { id: "x" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("remove deletes the thread scoped to the house", async () => {
  deleteReturning.mockResolvedValueOnce([{ id: "thread-1" }]);
  const result = await call(
    remove,
    { id: "thread-1" },
    { context: { headers: new Headers() } },
  );
  expect(result).toBe(true);
});

it("remove throws NOT_FOUND when the thread is missing", async () => {
  deleteReturning.mockResolvedValueOnce([]);
  await expect(
    call(remove, { id: "x" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});
