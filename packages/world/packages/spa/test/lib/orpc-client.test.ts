import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const client = { workspace: { sync: vi.fn() } };
  return {
    client,
    createClient: vi.fn(() => client),
    getActiveOrganizationId: vi.fn(),
  };
});

vi.mock("@openkitten/world-client", () => ({
  createClient: mocks.createClient,
}));

vi.mock("~/lib/get-active-organization-id", () => ({
  getActiveOrganizationId: mocks.getActiveOrganizationId,
}));

beforeEach(() => {
  mocks.createClient.mockClear();
  vi.resetModules();
});

it("creates the world client with the local server URL and the active organization id resolver", async () => {
  const { orpcClient } = await import("~/lib/orpc-client");

  expect(orpcClient).toBe(mocks.client);
  expect(mocks.createClient).toHaveBeenCalledTimes(1);
  expect(mocks.createClient).toHaveBeenCalledWith("http://localhost:41237", {
    getActiveOrganizationId: mocks.getActiveOrganizationId,
  });
});
