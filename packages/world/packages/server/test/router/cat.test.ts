import { call, ORPCError } from "@orpc/server";
import { beforeEach, expect, it, vi } from "vitest";

const {
  getSession,
  requireActiveHouse,
  requireMutatorAccess,
  generateCatSlug,
} = vi.hoisted(() => ({
  getSession: vi.fn(),
  requireActiveHouse: vi.fn(),
  requireMutatorAccess: vi.fn(),
  generateCatSlug: vi.fn(),
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
vi.mock("~/lib/require-mutator-access", () => ({ requireMutatorAccess }));
vi.mock("~/lib/generate-cat-slug", () => ({ generateCatSlug }));

const stubTable = { houseId: "_", id: "_", createdAt: "_" };
const stubOps = {
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => [a, b],
  asc: (col: unknown) => col,
};

vi.mock("~/lib/pg-database", () => ({
  pgDatabase: {
    query: {
      cat: {
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

const { list, get, create, update, remove } = await import("~/lib/router/cat");

const verifiedUser = {
  id: "u_1",
  name: "Ada",
  email: "ada@example.com",
  emailVerified: true,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sampleCat = {
  id: "cat-1",
  houseId: "house-1",
  name: "Misty",
  slug: "misty-abcdef",
  description: null,
  avatar: null,
  mood: "awake",
  isResting: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  getSession.mockReset();
  requireActiveHouse.mockReset();
  requireMutatorAccess.mockReset();
  generateCatSlug.mockReset();
  findMany.mockReset();
  findFirst.mockReset();
  insertReturning.mockReset();
  updateReturning.mockReset();
  deleteReturning.mockReset();
  getSession.mockResolvedValue({ user: verifiedUser });
  requireActiveHouse.mockResolvedValue("house-1");
  requireMutatorAccess.mockResolvedValue("house-1");
});

it("list returns cats scoped to the active house", async () => {
  findMany.mockResolvedValueOnce([sampleCat]);
  const result = await call(list, undefined, {
    context: { headers: new Headers() },
  });
  expect(result).toStrictEqual([sampleCat]);
  expect(requireActiveHouse).toHaveBeenCalledWith("u_1", undefined);
});

it("get returns the matching cat", async () => {
  findFirst.mockResolvedValueOnce(sampleCat);
  const result = await call(
    get,
    { id: "cat-1" },
    { context: { headers: new Headers() } },
  );
  expect(result).toStrictEqual(sampleCat);
});

it("get throws NOT_FOUND when the cat is not in the active house", async () => {
  findFirst.mockResolvedValueOnce(undefined);
  await expect(
    call(get, { id: "cat-1" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("create persists the cat with a generated id and slug", async () => {
  generateCatSlug.mockReturnValueOnce("misty-abcdef");
  insertReturning.mockResolvedValueOnce([sampleCat]);
  const result = await call(
    create,
    { name: "Misty" },
    { context: { headers: new Headers() } },
  );
  expect(result).toStrictEqual(sampleCat);
  expect(generateCatSlug).toHaveBeenCalledWith("Misty");
});

it("create persists optional description, avatar, and mood when provided", async () => {
  generateCatSlug.mockReturnValueOnce("misty-abcdef");
  insertReturning.mockResolvedValueOnce([sampleCat]);
  await call(
    create,
    {
      name: "Misty",
      description: "Helps with code review",
      avatar: "/cat.png",
      mood: "resting",
    },
    { context: { headers: new Headers() } },
  );
  expect(insertReturning).toHaveBeenCalled();
});

it("create throws INTERNAL_SERVER_ERROR when no row is returned", async () => {
  generateCatSlug.mockReturnValueOnce("misty-abcdef");
  insertReturning.mockResolvedValueOnce([]);
  await expect(
    call(create, { name: "Misty" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("update writes the changes scoped to the active house", async () => {
  updateReturning.mockResolvedValueOnce([{ ...sampleCat, name: "Mistique" }]);
  const result = await call(
    update,
    { id: "cat-1", name: "Mistique", isResting: true },
    { context: { headers: new Headers() } },
  );
  expect(result.name).toBe("Mistique");
});

it("update throws NOT_FOUND when no row matches", async () => {
  updateReturning.mockResolvedValueOnce([]);
  await expect(
    call(
      update,
      { id: "cat-1", name: "Mistique" },
      { context: { headers: new Headers() } },
    ),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("remove deletes the cat scoped to the active house", async () => {
  deleteReturning.mockResolvedValueOnce([{ id: "cat-1" }]);
  const result = await call(
    remove,
    { id: "cat-1" },
    { context: { headers: new Headers() } },
  );
  expect(result).toBe(true);
});

it("remove throws NOT_FOUND when the cat is missing", async () => {
  deleteReturning.mockResolvedValueOnce([]);
  await expect(
    call(remove, { id: "cat-1" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("create rejects when requireMutatorAccess throws (member role)", async () => {
  requireMutatorAccess.mockRejectedValueOnce(
    new ORPCError("FORBIDDEN", { message: "Members cannot create cats" }),
  );
  await expect(
    call(create, { name: "Misty" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
  expect(insertReturning).not.toHaveBeenCalled();
});

it("update rejects when requireMutatorAccess throws", async () => {
  requireMutatorAccess.mockRejectedValueOnce(
    new ORPCError("FORBIDDEN", { message: "Members cannot update cats" }),
  );
  await expect(
    call(
      update,
      { id: "cat-1", name: "x" },
      { context: { headers: new Headers() } },
    ),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("remove rejects when requireMutatorAccess throws", async () => {
  requireMutatorAccess.mockRejectedValueOnce(
    new ORPCError("FORBIDDEN", { message: "Members cannot remove cats" }),
  );
  await expect(
    call(remove, { id: "cat-1" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("create persists with the houseId from requireMutatorAccess", async () => {
  generateCatSlug.mockReturnValueOnce("misty-abcdef");
  const valuesArg = vi.fn();
  const insertSpy = vi.fn(() => ({
    values: (v: unknown) => {
      valuesArg(v);
      return { returning: insertReturning };
    },
  }));
  const { pgDatabase } = await import("~/lib/pg-database");
  vi.spyOn(pgDatabase, "insert").mockImplementationOnce(
    insertSpy as unknown as typeof pgDatabase.insert,
  );
  insertReturning.mockResolvedValueOnce([sampleCat]);
  await call(
    create,
    { name: "Misty", description: "Calm" },
    { context: { headers: new Headers() } },
  );
  expect(valuesArg).toHaveBeenCalledWith(
    expect.objectContaining({
      houseId: "house-1",
      name: "Misty",
      slug: "misty-abcdef",
      description: "Calm",
      mood: "awake",
    }),
  );
});

it("create retries on slug unique-violation and succeeds on the second attempt", async () => {
  generateCatSlug.mockReturnValueOnce("misty-aaaaaa");
  generateCatSlug.mockReturnValueOnce("misty-bbbbbb");
  const conflict = Object.assign(new Error("dup"), {
    code: "23505",
    constraint: "cat_house_id_slug_uidx",
  });
  insertReturning.mockRejectedValueOnce(conflict);
  insertReturning.mockResolvedValueOnce([sampleCat]);
  const result = await call(
    create,
    { name: "Misty" },
    { context: { headers: new Headers() } },
  );
  expect(result).toStrictEqual(sampleCat);
  expect(generateCatSlug).toHaveBeenCalledTimes(2);
});

it("create rethrows non-unique-violation database errors without retrying", async () => {
  generateCatSlug.mockReturnValueOnce("misty-aaaaaa");
  const dbError = Object.assign(new Error("connection lost"), {
    code: "08006",
  });
  insertReturning.mockRejectedValueOnce(dbError);
  await expect(
    call(create, { name: "Misty" }, { context: { headers: new Headers() } }),
  ).rejects.toBe(dbError);
  expect(generateCatSlug).toHaveBeenCalledTimes(1);
});

it("create gives up after 5 slug conflicts and throws INTERNAL_SERVER_ERROR", async () => {
  generateCatSlug.mockReturnValue("misty-xxxxxx");
  const conflict = Object.assign(new Error("dup"), {
    code: "23505",
    constraint: "cat_house_id_slug_uidx",
  });
  for (let i = 0; i < 5; i++) {
    insertReturning.mockRejectedValueOnce(conflict);
  }
  await expect(
    call(create, { name: "Misty" }, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("create rethrows a non-object thrown value without retrying", async () => {
  generateCatSlug.mockReturnValueOnce("misty-aaaaaa");
  insertReturning.mockImplementationOnce(() => {
    throw "boom";
  });
  await expect(
    call(create, { name: "Misty" }, { context: { headers: new Headers() } }),
  ).rejects.toBe("boom");
  expect(generateCatSlug).toHaveBeenCalledTimes(1);
});
