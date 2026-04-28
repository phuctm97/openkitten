import { serverPort } from "@openkitten/world-util";
import { beforeEach, expect, it, vi } from "vitest";
import server from "~/lib/main";

const { execute, handler, rpcHandle, websiteOrigin } = vi.hoisted(() => ({
  execute: vi.fn(async () => ({ rows: [] })),
  handler: vi.fn(
    async (request: Request) =>
      new Response(`auth:${new URL(request.url).pathname}`),
  ),
  rpcHandle: vi.fn(
    async (
      _request: Request,
      _options: { prefix: string; context: { headers: Headers } },
    ): Promise<{ matched: boolean; response: Response | undefined }> => ({
      matched: true,
      response: new Response("rpc-response"),
    }),
  ),
  websiteOrigin: "http://localhost:41239",
}));

vi.mock("~/lib/pg-database", () => ({ pgDatabase: { execute } }));
vi.mock("~/lib/auth", () => ({
  auth: {
    options: {
      basePath: "/auth",
      trustedOrigins: [websiteOrigin, "http://localhost:41237"],
    },
    handler,
  },
}));
vi.mock("~/lib/rpc-handler", () => ({ rpcHandler: { handle: rpcHandle } }));

beforeEach(() => {
  execute.mockClear();
  handler.mockClear();
  rpcHandle.mockClear();
});

it("exports a Bun-compatible server definition", () => {
  expect(server).toStrictEqual({
    port: serverPort,
    fetch: server.fetch,
  });
});

it("checks the database on the health route", async () => {
  const response = await server.fetch(new Request("http://localhost/health"));

  expect(response.status).toBe(200);
  expect(execute).toHaveBeenCalledTimes(1);
  await expect(response.text()).resolves.toBe("OK");
});

it("routes auth requests to better-auth", async () => {
  const response = await server.fetch(
    new Request("http://localhost/auth/sign-in/email", {
      method: "POST",
      headers: { Origin: websiteOrigin },
    }),
  );

  expect(handler).toHaveBeenCalledTimes(1);
  expect(response.headers.get("access-control-allow-origin")).toBe(
    websiteOrigin,
  );
  expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  await expect(response.text()).resolves.toBe("auth:/auth/sign-in/email");
});

it("routes rpc requests to the rpc handler with the request headers", async () => {
  const response = await server.fetch(
    new Request("http://localhost/rpc/me", { method: "POST" }),
  );

  expect(rpcHandle).toHaveBeenCalledTimes(1);
  const handleCall = rpcHandle.mock.calls[0];
  expect(handleCall).toBeDefined();
  if (!handleCall) {
    throw new Error("Expected rpc handler to be called");
  }
  const [, options] = handleCall;
  expect(options.prefix).toBe("/rpc");
  expect(options.context.headers).toBeInstanceOf(Headers);
  await expect(response.text()).resolves.toBe("rpc-response");
});

it("returns not found when the rpc handler does not match", async () => {
  rpcHandle.mockResolvedValueOnce({
    matched: false,
    response: undefined,
  });

  const response = await server.fetch(
    new Request("http://localhost/rpc/missing", { method: "POST" }),
  );

  expect(response.status).toBe(404);
});
