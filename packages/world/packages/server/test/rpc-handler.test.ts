import { RPCHandler } from "@orpc/server/fetch";
import { expect, test, vi } from "vitest";

vi.mock("~/lib/auth", () => ({
  auth: {
    api: { getSession: vi.fn() },
    options: { basePath: "/auth", trustedOrigins: [] },
    handler: vi.fn(),
  },
}));

const { rpcHandler } = await import("~/lib/rpc-handler");

test("rpcHandler is an RPCHandler instance", () => {
  expect(rpcHandler).toBeInstanceOf(RPCHandler);
});
