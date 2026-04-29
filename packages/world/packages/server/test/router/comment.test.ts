import { call, ORPCError } from "@orpc/server";
import { beforeEach, expect, it, vi } from "vitest";

const { getSession, requireActiveHouse } = vi.hoisted(() => ({
  getSession: vi.fn(),
  requireActiveHouse: vi.fn(),
}));

const findManyComments = vi.fn();
const findFirstThread = vi.fn();
const findFirstComment = vi.fn();
const insertReturning = vi.fn();
const threadUpdateWhere = vi.fn();
const commentDeleteWhere = vi.fn();

vi.mock("~/lib/auth", () => ({
  auth: {
    api: { getSession },
    options: { basePath: "/auth", trustedOrigins: [] },
    handler: vi.fn(),
  },
}));

vi.mock("~/lib/require-active-house", () => ({ requireActiveHouse }));

const stubTable = { threadId: "_", id: "_", createdAt: "_", houseId: "_" };
const stubOps = {
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => [a, b],
  asc: (col: unknown) => col,
};

vi.mock("~/lib/pg-database", () => ({
  pgDatabase: {
    query: {
      thread: {
        findFirst: async (args: {
          where: (t: unknown, o: unknown) => unknown;
        }) => {
          args.where(stubTable, stubOps);
          return findFirstThread(args);
        },
      },
      comment: {
        findMany: async (args: {
          where: (t: unknown, o: unknown) => unknown;
          orderBy: (t: unknown, o: unknown) => unknown;
        }) => {
          args.where(stubTable, stubOps);
          args.orderBy(stubTable, stubOps);
          return findManyComments(args);
        },
        findFirst: async (args: {
          where: (t: unknown, o: unknown) => unknown;
        }) => {
          args.where(stubTable, stubOps);
          return findFirstComment();
        },
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: insertReturning })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: threadUpdateWhere })),
    })),
    delete: vi.fn(() => ({ where: commentDeleteWhere })),
  },
}));

const { listByThread, create, remove } = await import("~/lib/router/comment");

const verifiedUser = {
  id: "u_1",
  name: "Ada",
  email: "ada@example.com",
  emailVerified: true,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sampleComment = {
  id: "comment-1",
  threadId: "thread-1",
  authorUserId: "u_1",
  authorCatId: null,
  body: "Looks good",
  createdAt: new Date(),
};

beforeEach(() => {
  getSession.mockReset();
  requireActiveHouse.mockReset();
  findManyComments.mockReset();
  findFirstThread.mockReset();
  findFirstComment.mockReset();
  insertReturning.mockReset();
  threadUpdateWhere.mockReset();
  commentDeleteWhere.mockReset();
  getSession.mockResolvedValue({ user: verifiedUser });
  requireActiveHouse.mockResolvedValue("house-1");
});

it("listByThread returns comments after verifying the thread is in the house", async () => {
  findFirstThread.mockResolvedValueOnce({ id: "thread-1" });
  findManyComments.mockResolvedValueOnce([sampleComment]);
  const result = await call(
    listByThread,
    { threadId: "thread-1" },
    { context: { headers: new Headers() } },
  );
  expect(result).toStrictEqual([sampleComment]);
});

it("listByThread throws NOT_FOUND when the thread is not in the active house", async () => {
  findFirstThread.mockResolvedValueOnce(undefined);
  await expect(
    call(
      listByThread,
      { threadId: "thread-1" },
      { context: { headers: new Headers() } },
    ),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("create inserts a comment authored by the active user and bumps the thread", async () => {
  findFirstThread.mockResolvedValueOnce({ id: "thread-1" });
  insertReturning.mockResolvedValueOnce([sampleComment]);
  const result = await call(
    create,
    { threadId: "thread-1", body: "Looks good" },
    { context: { headers: new Headers() } },
  );
  expect(result).toStrictEqual(sampleComment);
  expect(threadUpdateWhere).toHaveBeenCalled();
});

it("create throws NOT_FOUND when the thread is missing", async () => {
  findFirstThread.mockResolvedValueOnce(undefined);
  await expect(
    call(
      create,
      { threadId: "x", body: "..." },
      { context: { headers: new Headers() } },
    ),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("create throws INTERNAL_SERVER_ERROR when insertion returns no row", async () => {
  findFirstThread.mockResolvedValueOnce({ id: "thread-1" });
  insertReturning.mockResolvedValueOnce([]);
  await expect(
    call(
      create,
      { threadId: "thread-1", body: "x" },
      { context: { headers: new Headers() } },
    ),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("remove deletes the comment when its thread is in the active house", async () => {
  findFirstComment.mockReturnValueOnce({
    id: "comment-1",
    thread: { houseId: "house-1" },
  });
  await call(
    remove,
    { id: "comment-1" },
    { context: { headers: new Headers() } },
  );
  expect(commentDeleteWhere).toHaveBeenCalled();
});

it("remove throws NOT_FOUND when the comment is missing", async () => {
  findFirstComment.mockReturnValueOnce(undefined);
  await expect(
    call(remove, { id: "x" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("remove throws NOT_FOUND when the comment's thread is in a different house", async () => {
  findFirstComment.mockReturnValueOnce({
    id: "comment-1",
    thread: { houseId: "other-house" },
  });
  await expect(
    call(remove, { id: "comment-1" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});
