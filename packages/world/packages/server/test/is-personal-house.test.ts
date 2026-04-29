import { beforeEach, expect, it, vi } from "vitest";

const findFirstWorkspace = vi.hoisted(() => vi.fn());

const stubTable = { userId: "_", houseId: "_" };
const stubOps = { eq: (a: unknown, b: unknown) => [a, b] };

vi.mock("~/lib/pg-database", () => ({
  pgDatabase: {
    query: {
      workspace: {
        findFirst: async (args: {
          where?: (t: unknown, o: unknown) => unknown;
        }) => {
          args.where?.(stubTable, stubOps);
          return findFirstWorkspace(args);
        },
      },
    },
  },
}));

const { isPersonalHouse } = await import("~/lib/is-personal-house");

beforeEach(() => {
  findFirstWorkspace.mockReset();
});

it("returns true when the workspace has a userId set", async () => {
  findFirstWorkspace.mockResolvedValueOnce({ userId: "u_1" });
  await expect(isPersonalHouse("house_1")).resolves.toBe(true);
});

it("returns false when the workspace has no userId", async () => {
  findFirstWorkspace.mockResolvedValueOnce({ userId: null });
  await expect(isPersonalHouse("house_1")).resolves.toBe(false);
});

it("returns false when the workspace row is missing", async () => {
  findFirstWorkspace.mockResolvedValueOnce(undefined);
  await expect(isPersonalHouse("house_unknown")).resolves.toBe(false);
});
