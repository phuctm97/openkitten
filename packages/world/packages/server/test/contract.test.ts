import { expect, test, vi } from "vitest";

vi.mock("~/lib/auth", () => ({
  auth: {
    api: { getSession: vi.fn() },
    options: { basePath: "/auth", trustedOrigins: [] },
    handler: vi.fn(),
  },
}));

const { contract } = await import("~/lib/contract");

test("contract exposes the me procedure builder from the merged contract", () => {
  expect(contract.me).toBeDefined();
});

test("contract exposes the workspace.sync procedure builder", () => {
  expect(contract.workspace.sync).toBeDefined();
});

test("contract exposes a use method to chain middleware", () => {
  expect(typeof contract.use).toBe("function");
});
