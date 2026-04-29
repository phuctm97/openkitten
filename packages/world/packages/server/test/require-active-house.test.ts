import { ORPCError } from "@orpc/server";
import { beforeEach, expect, it, vi } from "vitest";

const findFirstWorkspace = vi.fn();
const findFirstMember = vi.fn();

vi.mock("~/lib/pg-database", () => ({
  pgDatabase: {
    query: {
      workspace: { findFirst: findFirstWorkspace },
      house_member: { findFirst: findFirstMember },
    },
  },
}));

const { requireActiveHouse } = await import("~/lib/require-active-house");

beforeEach(() => {
  findFirstWorkspace.mockReset();
  findFirstMember.mockReset();
});

it("returns the active member's organization id when one is set", async () => {
  const houseId = await requireActiveHouse("user-1", {
    organizationId: "house-1",
    role: "owner",
    createdAt: new Date(),
    isPersonal: true,
  });
  expect(houseId).toBe("house-1");
  expect(findFirstWorkspace).not.toHaveBeenCalled();
  expect(findFirstMember).not.toHaveBeenCalled();
});

it("falls back to the user's personal workspace when no active member is set", async () => {
  findFirstWorkspace.mockResolvedValueOnce({ houseId: "personal-house" });
  const houseId = await requireActiveHouse("user-1", undefined);
  expect(houseId).toBe("personal-house");
  expect(findFirstWorkspace).toHaveBeenCalledTimes(1);
  expect(findFirstMember).not.toHaveBeenCalled();
});

it("falls back to the user's first house membership when no personal workspace exists", async () => {
  findFirstWorkspace.mockResolvedValueOnce(undefined);
  findFirstMember.mockResolvedValueOnce({ house_id: "shared-house" });
  const houseId = await requireActiveHouse("user-1", undefined);
  expect(houseId).toBe("shared-house");
});

it("throws FORBIDDEN when the user has no house anywhere", async () => {
  findFirstWorkspace.mockResolvedValueOnce(undefined);
  findFirstMember.mockResolvedValueOnce(undefined);
  await expect(requireActiveHouse("user-1", undefined)).rejects.toBeInstanceOf(
    ORPCError,
  );
});

it("invokes the workspace where/columns and the member where/columns/orderBy callbacks", async () => {
  const stubTable = { userId: "_", house_id: "_", createdAt: "_" };
  const stubOps = {
    eq: (a: unknown, b: unknown) => [a, b],
    asc: (col: unknown) => col,
  };
  findFirstWorkspace.mockImplementationOnce(async (args) => {
    args.where(stubTable, stubOps);
    return undefined;
  });
  findFirstMember.mockImplementationOnce(async (args) => {
    args.where(stubTable, stubOps);
    args.orderBy(stubTable, stubOps);
    return { house_id: "found" };
  });
  const houseId = await requireActiveHouse("user-1", undefined);
  expect(houseId).toBe("found");
});
