import { expect, test, vi } from "vitest";

vi.mock("~/lib/auth", () => ({
  auth: {
    api: { getSession: vi.fn() },
    options: { basePath: "/auth", trustedOrigins: [] },
    handler: vi.fn(),
  },
}));

vi.mock("~/lib/pg-database", () => ({
  pgDatabase: { query: { house_member: { findFirst: vi.fn() } } },
}));

vi.mock("~/lib/sync-workspace", () => ({ syncWorkspace: vi.fn() }));

const { workspace } = await import("~/lib/router/workspace");

test("aggregates the sync handler under the workspace folder", () => {
  expect(workspace.sync).toBeDefined();
});
