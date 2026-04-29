import { call, ORPCError } from "@orpc/server";
import { beforeEach, expect, it, vi } from "vitest";

const { getSession, requireActiveHouse } = vi.hoisted(() => ({
  getSession: vi.fn(),
  requireActiveHouse: vi.fn(),
}));

const findMany = vi.fn();
const insertReturning = vi.fn();
const updateReturning = vi.fn();
const updateAllWhere = vi.fn();
const deleteReturning = vi.fn();

vi.mock("~/lib/auth", () => ({
  auth: {
    api: { getSession },
    options: { basePath: "/auth", trustedOrigins: [] },
    handler: vi.fn(),
  },
}));

vi.mock("~/lib/require-active-house", () => ({ requireActiveHouse }));

const stubTable = { houseId: "_", id: "_", readAt: "_", createdAt: "_" };
const stubOps = {
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => [a, b],
  isNull: (col: unknown) => col,
  desc: (col: unknown) => col,
};

vi.mock("~/lib/pg-database", () => ({
  pgDatabase: {
    query: {
      notice: {
        findMany: async (args: {
          where: (t: unknown, o: unknown) => unknown;
          orderBy: (t: unknown, o: unknown) => unknown;
        }) => {
          args.where(stubTable, stubOps);
          args.orderBy(stubTable, stubOps);
          return findMany(args);
        },
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: insertReturning })),
    })),
    update: vi.fn((..._args: unknown[]) => {
      void _args;
      return {
        set: vi.fn(() => ({
          where: vi.fn((...args: unknown[]) => {
            updateAllWhere(...args);
            return { returning: updateReturning };
          }),
        })),
      };
    }),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({ returning: deleteReturning })),
    })),
  },
}));

const { list, create, markRead, markAllRead, remove } = await import(
  "~/lib/router/notice"
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

const sampleNotice = {
  id: "notice-1",
  houseId: "house-1",
  kind: "general",
  subject: "Heads up",
  body: null,
  threadId: null,
  catId: null,
  readAt: null,
  createdAt: new Date(),
};

beforeEach(() => {
  getSession.mockReset();
  requireActiveHouse.mockReset();
  findMany.mockReset();
  insertReturning.mockReset();
  updateReturning.mockReset();
  updateAllWhere.mockReset();
  deleteReturning.mockReset();
  getSession.mockResolvedValue({ user: verifiedUser });
  requireActiveHouse.mockResolvedValue("house-1");
});

it("list returns all notices when no filter is set", async () => {
  findMany.mockResolvedValueOnce([sampleNotice]);
  const result = await call(list, undefined, {
    context: { headers: new Headers() },
  });
  expect(result).toStrictEqual([sampleNotice]);
});

it("list applies the onlyUnread filter", async () => {
  findMany.mockResolvedValueOnce([sampleNotice]);
  await call(
    list,
    { onlyUnread: true },
    { context: { headers: new Headers() } },
  );
  expect(findMany).toHaveBeenCalled();
});

it("create persists a notice with optional fields", async () => {
  insertReturning.mockResolvedValueOnce([sampleNotice]);
  const result = await call(
    create,
    {
      kind: "thread",
      subject: "New comment",
      body: "Body",
      threadId: "thread-1",
      catId: "cat-1",
    },
    { context: { headers: new Headers() } },
  );
  expect(result).toStrictEqual(sampleNotice);
});

it("create defaults kind to general", async () => {
  insertReturning.mockResolvedValueOnce([sampleNotice]);
  await call(
    create,
    { subject: "Heads up" },
    { context: { headers: new Headers() } },
  );
  expect(insertReturning).toHaveBeenCalled();
});

it("create throws INTERNAL_SERVER_ERROR when insertion returns no row", async () => {
  insertReturning.mockResolvedValueOnce([]);
  await expect(
    call(create, { subject: "X" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("markRead stamps readAt and returns the notice", async () => {
  updateReturning.mockResolvedValueOnce([
    { ...sampleNotice, readAt: new Date() },
  ]);
  const result = await call(
    markRead,
    { id: "notice-1" },
    { context: { headers: new Headers() } },
  );
  expect(result.readAt).not.toBeNull();
});

it("markRead throws NOT_FOUND when no notice matches", async () => {
  updateReturning.mockResolvedValueOnce([]);
  await expect(
    call(markRead, { id: "x" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("markAllRead bulk-updates unread notices in the active house", async () => {
  const result = await call(markAllRead, undefined, {
    context: { headers: new Headers() },
  });
  expect(result).toBe(true);
  expect(updateAllWhere).toHaveBeenCalled();
});

it("remove deletes the notice scoped to the house", async () => {
  deleteReturning.mockResolvedValueOnce([{ id: "notice-1" }]);
  const result = await call(
    remove,
    { id: "notice-1" },
    { context: { headers: new Headers() } },
  );
  expect(result).toBe(true);
});

it("remove throws NOT_FOUND when the notice is missing", async () => {
  deleteReturning.mockResolvedValueOnce([]);
  await expect(
    call(remove, { id: "x" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});
