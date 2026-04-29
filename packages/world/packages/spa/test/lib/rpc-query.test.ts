import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const queryUtils = { me: { queryOptions: vi.fn() } };
  return {
    queryUtils,
    createWorldQuery: vi.fn(() => queryUtils),
  };
});

vi.mock("@openkitten/world-client", () => ({
  createWorldQuery: mocks.createWorldQuery,
  createWorldClient: vi.fn(),
}));

beforeEach(() => {
  mocks.createWorldQuery.mockClear();
  vi.resetModules();
});

it("creates the world query utils with the local server URL and an active organization id resolver", async () => {
  const { rpcQuery } = await import("~/lib/rpc-query");

  expect(rpcQuery).toBe(mocks.queryUtils);
  expect(mocks.createWorldQuery).toHaveBeenCalledTimes(1);
  expect(mocks.createWorldQuery).toHaveBeenCalledWith(
    "http://localhost:41237",
    {
      getActiveOrganizationId: expect.any(Function),
    },
  );
});
