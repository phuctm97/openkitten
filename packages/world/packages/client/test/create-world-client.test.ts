import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createWorldClient } from "~/lib/create-world-client";

const fetchMock = vi.fn(async (input: Request, init?: RequestInit) => {
  void input;
  void init;
  return new Response(JSON.stringify({ json: "out" }), {
    headers: { "content-type": "application/json" },
  });
});

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("returns a typed client with the contract procedures", () => {
  const client = createWorldClient("http://localhost:1234");
  expect(typeof client.me).toBe("function");
  expect(typeof client.workspace.sync).toBe("function");
});

it("sends fetch calls with credentials included to the configured base url", async () => {
  const client = createWorldClient("http://localhost:1234");
  await client.me().catch(() => {});

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const call = fetchMock.mock.calls[0];
  expect(call).toBeDefined();
  if (!call) {
    throw new Error("Expected fetch to be called");
  }
  const [request, init] = call;
  expect(request).toBeInstanceOf(Request);
  expect(request.url.startsWith("http://localhost:1234/rpc")).toBe(true);
  expect(init?.credentials).toBe("include");
});

it("attaches the active organization header when getActiveOrganizationId returns a value", async () => {
  const client = createWorldClient("http://localhost:1234", {
    getActiveOrganizationId: () => "org_42",
  });
  await client.me().catch(() => {});

  const call = fetchMock.mock.calls[0];
  if (!call) throw new Error("Expected fetch to be called");
  const [request] = call;
  expect(request.headers.get("x-active-organization-id")).toBe("org_42");
});

it("omits the active organization header when getActiveOrganizationId is not provided", async () => {
  const client = createWorldClient("http://localhost:1234");
  await client.me().catch(() => {});

  const call = fetchMock.mock.calls[0];
  if (!call) throw new Error("Expected fetch to be called");
  const [request] = call;
  expect(request.headers.get("x-active-organization-id")).toBeNull();
});

it("omits the active organization header when getActiveOrganizationId returns undefined", async () => {
  const client = createWorldClient("http://localhost:1234", {
    getActiveOrganizationId: () => undefined,
  });
  await client.me().catch(() => {});

  const call = fetchMock.mock.calls[0];
  if (!call) throw new Error("Expected fetch to be called");
  const [request] = call;
  expect(request.headers.get("x-active-organization-id")).toBeNull();
});
