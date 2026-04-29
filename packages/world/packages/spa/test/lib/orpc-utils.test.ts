import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const client = { workspace: { sync: vi.fn() } };
  const utils = { workspace: { sync: { queryOptions: vi.fn() } } };
  return {
    client,
    utils,
    createTanstackQueryUtils: vi.fn(() => utils),
  };
});

vi.mock("@orpc/tanstack-query", () => ({
  createTanstackQueryUtils: mocks.createTanstackQueryUtils,
}));

vi.mock("~/lib/orpc-client", () => ({ orpcClient: mocks.client }));

beforeEach(() => {
  mocks.createTanstackQueryUtils.mockClear();
  vi.resetModules();
});

it("wraps the orpc client with tanstack query utils", async () => {
  const { orpcUtils } = await import("~/lib/orpc-utils");

  expect(orpcUtils).toBe(mocks.utils);
  expect(mocks.createTanstackQueryUtils).toHaveBeenCalledTimes(1);
  expect(mocks.createTanstackQueryUtils).toHaveBeenCalledWith(mocks.client);
});
