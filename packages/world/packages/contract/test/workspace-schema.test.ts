import { expect, test } from "vitest";
import { workspaceSchema } from "~/lib/workspace-schema";

const sampleWorkspace = {
  workspace: {
    id: 1,
    userId: "u_1",
    houseId: "house_1",
    isPersonal: true,
    createdAt: new Date("2026-04-28T00:00:00Z"),
    updatedAt: new Date("2026-04-28T00:00:00Z"),
  },
  house: {
    id: "house_1",
    name: "Ada's House",
    slug: "ada-house",
    logo: null,
    metadata: null,
    createdAt: new Date("2026-04-28T00:00:00Z"),
  },
  members: [
    {
      id: "m_1",
      userId: "u_1",
      role: "owner",
      createdAt: new Date("2026-04-28T00:00:00Z"),
      user: {
        id: "u_1",
        name: "Ada",
        email: "ada@example.com",
        image: null,
      },
    },
  ],
  invitations: [],
  activeMember: {
    id: "m_1",
    role: "owner",
    createdAt: new Date("2026-04-28T00:00:00Z"),
  },
};

test("accepts a personal workspace", () => {
  const result = workspaceSchema.parse(sampleWorkspace);
  expect(result.workspace.isPersonal).toBe(true);
});

test("accepts a member without an image url", () => {
  const result = workspaceSchema.parse(sampleWorkspace);
  expect(result.members[0]?.user.image).toBeNull();
});

test("accepts an invitation with a null role", () => {
  const result = workspaceSchema.parse({
    ...sampleWorkspace,
    invitations: [
      {
        id: "i_1",
        email: "teammate@example.com",
        role: null,
        status: "pending",
        expiresAt: new Date("2026-05-28T00:00:00Z"),
      },
    ],
  });
  expect(result.invitations[0]?.role).toBeNull();
});

test("rejects when activeMember.id is missing", () => {
  expect(() =>
    workspaceSchema.parse({
      ...sampleWorkspace,
      activeMember: { role: "owner", createdAt: new Date() },
    }),
  ).toThrow();
});
