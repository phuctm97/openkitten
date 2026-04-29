import { call, ORPCError } from "@orpc/server";
import { beforeEach, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("~/lib/auth", () => ({
  auth: {
    api: { getSession },
    options: { basePath: "/auth", trustedOrigins: [] },
    handler: vi.fn(),
  },
}));

vi.mock("~/lib/pg-database", () => ({
  pgDatabase: {
    query: {
      member: {
        findFirst: vi.fn(),
      },
    },
  },
}));

const { me } = await import("~/lib/router/me");

beforeEach(() => {
  getSession.mockReset();
});

const validUser = {
  id: "u_1",
  name: "Ada",
  email: "ada@example.com",
  emailVerified: true,
  image: null,
  createdAt: new Date("2026-04-28T00:00:00Z"),
  updatedAt: new Date("2026-04-28T00:00:00Z"),
};

it("returns the active user when a session exists and email is verified", async () => {
  getSession.mockResolvedValueOnce({ user: validUser });

  const result = await call(me, undefined, {
    context: { headers: new Headers() },
  });

  expect(result).toStrictEqual(validUser);
});

it("rejects with UNAUTHORIZED when no session is present", async () => {
  getSession.mockResolvedValueOnce(null);

  await expect(
    call(me, undefined, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});

it("rejects with UNAUTHORIZED when the user has not verified their email", async () => {
  getSession.mockResolvedValueOnce({
    user: { ...validUser, emailVerified: false },
  });

  await expect(
    call(me, undefined, { context: { headers: new Headers() } }),
  ).rejects.toBeInstanceOf(ORPCError);
});
