import { expect, test } from "vitest";
import { sync } from "~/lib/router/workspace/sync";

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

test("exposes an output schema", () => {
  expect(sync["~orpc"].outputSchema).toBeDefined();
});

test("output schema accepts a personal workspace shape", () => {
  const def = sync["~orpc"];
  const result: unknown = def.outputSchema?.parse(sampleWorkspace);
  expect(result).toMatchObject({
    workspace: { isPersonal: true, userId: "u_1" },
    house: { name: "Ada's House" },
  });
});

test("output schema accepts a team workspace shape", () => {
  const def = sync["~orpc"];
  const result: unknown = def.outputSchema?.parse({
    ...sampleWorkspace,
    workspace: {
      ...sampleWorkspace.workspace,
      userId: null,
      isPersonal: false,
    },
    invitations: [
      {
        id: "i_1",
        email: "teammate@example.com",
        role: "member",
        status: "pending",
        expiresAt: new Date("2026-05-28T00:00:00Z"),
      },
    ],
  });
  expect(result).toMatchObject({
    workspace: { isPersonal: false, userId: null },
  });
});

test("output schema rejects when workspace is missing", () => {
  const def = sync["~orpc"];
  const { workspace: _w, ...rest } = sampleWorkspace;
  expect(() => def.outputSchema?.parse(rest)).toThrow();
});

test("output schema rejects when activeMember is missing", () => {
  const def = sync["~orpc"];
  const { activeMember: _a, ...rest } = sampleWorkspace;
  expect(() => def.outputSchema?.parse(rest)).toThrow();
});

test("output schema accepts an invitation with a null role", () => {
  const def = sync["~orpc"];
  const result: unknown = def.outputSchema?.parse({
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
  expect(result).toMatchObject({ invitations: [{ role: null }] });
});

test("output schema rejects when activeMember.id is missing", () => {
  const def = sync["~orpc"];
  expect(() =>
    def.outputSchema?.parse({
      ...sampleWorkspace,
      activeMember: { role: "owner", createdAt: new Date() },
    }),
  ).toThrow();
});

test("output schema rejects when a member is missing required user fields", () => {
  const def = sync["~orpc"];
  expect(() =>
    def.outputSchema?.parse({
      ...sampleWorkspace,
      members: [
        {
          id: "m",
          userId: "u",
          role: "owner",
          createdAt: new Date(),
          user: { id: "u" },
        },
      ],
    }),
  ).toThrow();
});
