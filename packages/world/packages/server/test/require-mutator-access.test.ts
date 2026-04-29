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

const { requireMutatorAccess } = await import("~/lib/require-mutator-access");

beforeEach(() => {
  findFirstWorkspace.mockReset();
  findFirstMember.mockReset();
});

it("returns the active member's organization id when role is owner", async () => {
  const houseId = await requireMutatorAccess("user-1", {
    organizationId: "house-1",
    role: "owner",
    createdAt: new Date(),
    isPersonal: false,
  });
  expect(houseId).toBe("house-1");
  expect(findFirstWorkspace).not.toHaveBeenCalled();
});

it("returns the active member's organization id when role is admin", async () => {
  const houseId = await requireMutatorAccess("user-1", {
    organizationId: "house-1",
    role: "admin",
    createdAt: new Date(),
    isPersonal: false,
  });
  expect(houseId).toBe("house-1");
});

it("rejects FORBIDDEN when active member's role is member", async () => {
  await expect(
    requireMutatorAccess("user-1", {
      organizationId: "house-1",
      role: "member",
      createdAt: new Date(),
      isPersonal: false,
    }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("rejects FORBIDDEN when active member's role is anything other than owner/admin", async () => {
  await expect(
    requireMutatorAccess("user-1", {
      organizationId: "house-1",
      role: "viewer",
      createdAt: new Date(),
      isPersonal: false,
    }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("returns the personal house id when the personal member has owner role", async () => {
  findFirstWorkspace.mockResolvedValueOnce({ houseId: "personal-house" });
  findFirstMember.mockResolvedValueOnce({ role: "owner" });
  const houseId = await requireMutatorAccess("user-1", undefined);
  expect(houseId).toBe("personal-house");
});

it("rejects FORBIDDEN when the personal member exists but role is member", async () => {
  findFirstWorkspace.mockResolvedValueOnce({ houseId: "personal-house" });
  findFirstMember.mockResolvedValueOnce({ role: "member" });
  await expect(
    requireMutatorAccess("user-1", undefined),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("rejects FORBIDDEN when the personal workspace exists but no membership row exists", async () => {
  findFirstWorkspace.mockResolvedValueOnce({ houseId: "personal-house" });
  findFirstMember.mockResolvedValueOnce(undefined);
  await expect(
    requireMutatorAccess("user-1", undefined),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("falls back to the first membership when no personal workspace exists and role is owner", async () => {
  findFirstWorkspace.mockResolvedValueOnce(undefined);
  findFirstMember.mockResolvedValueOnce({
    house_id: "shared-house",
    role: "owner",
  });
  const houseId = await requireMutatorAccess("user-1", undefined);
  expect(houseId).toBe("shared-house");
});

it("rejects FORBIDDEN when the first membership has member role", async () => {
  findFirstWorkspace.mockResolvedValueOnce(undefined);
  findFirstMember.mockResolvedValueOnce({
    house_id: "shared-house",
    role: "member",
  });
  await expect(
    requireMutatorAccess("user-1", undefined),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("rejects FORBIDDEN when the user has no house anywhere", async () => {
  findFirstWorkspace.mockResolvedValueOnce(undefined);
  findFirstMember.mockResolvedValueOnce(undefined);
  await expect(
    requireMutatorAccess("user-1", undefined),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("invokes the workspace and member where/columns/orderBy callbacks", async () => {
  const stubTable = { userId: "_", house_id: "_", createdAt: "_" };
  const stubOps = {
    eq: (a: unknown, b: unknown) => [a, b],
    and: (...parts: unknown[]) => parts,
    asc: (col: unknown) => col,
  };
  findFirstWorkspace.mockImplementationOnce(async (args) => {
    args.where(stubTable, stubOps);
    return undefined;
  });
  findFirstMember.mockImplementationOnce(async (args) => {
    args.where(stubTable, stubOps);
    args.orderBy(stubTable, stubOps);
    return { house_id: "found", role: "owner" };
  });
  const houseId = await requireMutatorAccess("user-1", undefined);
  expect(houseId).toBe("found");
});

it("invokes the personal-member where callback when a personal workspace exists", async () => {
  const stubTable = { userId: "_", house_id: "_" };
  const stubOps = {
    eq: (a: unknown, b: unknown) => [a, b],
    and: (...parts: unknown[]) => parts,
  };
  findFirstWorkspace.mockResolvedValueOnce({ houseId: "personal-house" });
  findFirstMember.mockImplementationOnce(async (args) => {
    args.where(stubTable, stubOps);
    return { role: "owner" };
  });
  const houseId = await requireMutatorAccess("user-1", undefined);
  expect(houseId).toBe("personal-house");
});
