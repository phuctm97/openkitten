import { expect, test, vi } from "vitest";

vi.mock("~/lib/auth", () => ({
  auth: {
    api: { getSession: vi.fn() },
    options: { basePath: "/auth", trustedOrigins: [] },
    handler: vi.fn(),
  },
}));

vi.mock("~/lib/pg-database", () => ({
  pgDatabase: {
    query: {
      house_member: { findFirst: vi.fn() },
      workspace: { findFirst: vi.fn() },
    },
  },
}));

vi.mock("~/lib/sync-workspace", () => ({ syncWorkspace: vi.fn() }));

const router = await import("~/lib/router");

test("re-exports the workspace folder as a nested router with sync", () => {
  expect(router.workspace.sync).toBeDefined();
});

test("exposes the cat router with full CRUD procedures", () => {
  expect(router.cat.list).toBeDefined();
  expect(router.cat.get).toBeDefined();
  expect(router.cat.create).toBeDefined();
  expect(router.cat.update).toBeDefined();
  expect(router.cat.remove).toBeDefined();
});

test("exposes the goal router with full CRUD procedures", () => {
  expect(router.goal.list).toBeDefined();
  expect(router.goal.get).toBeDefined();
  expect(router.goal.create).toBeDefined();
  expect(router.goal.update).toBeDefined();
  expect(router.goal.remove).toBeDefined();
});

test("exposes the thread router with CRUD plus close and reopen", () => {
  expect(router.thread.list).toBeDefined();
  expect(router.thread.get).toBeDefined();
  expect(router.thread.create).toBeDefined();
  expect(router.thread.update).toBeDefined();
  expect(router.thread.close).toBeDefined();
  expect(router.thread.reopen).toBeDefined();
  expect(router.thread.remove).toBeDefined();
});

test("exposes the comment router scoped by thread", () => {
  expect(router.comment.listByThread).toBeDefined();
  expect(router.comment.create).toBeDefined();
  expect(router.comment.remove).toBeDefined();
});

test("exposes the notice router with read/markAllRead actions", () => {
  expect(router.notice.list).toBeDefined();
  expect(router.notice.create).toBeDefined();
  expect(router.notice.markRead).toBeDefined();
  expect(router.notice.markAllRead).toBeDefined();
  expect(router.notice.remove).toBeDefined();
});

test("exposes the memo router with pin/unpin actions", () => {
  expect(router.memo.list).toBeDefined();
  expect(router.memo.get).toBeDefined();
  expect(router.memo.create).toBeDefined();
  expect(router.memo.update).toBeDefined();
  expect(router.memo.pin).toBeDefined();
  expect(router.memo.unpin).toBeDefined();
  expect(router.memo.remove).toBeDefined();
});

test("exposes the rule router with full CRUD procedures", () => {
  expect(router.rule.list).toBeDefined();
  expect(router.rule.get).toBeDefined();
  expect(router.rule.create).toBeDefined();
  expect(router.rule.update).toBeDefined();
  expect(router.rule.remove).toBeDefined();
});
