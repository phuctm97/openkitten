import { beforeEach, expect, it, vi } from "vitest";
import server from "~/lib/main";
import { serverPort } from "~/lib/server-port";

const { execute, handler, websiteOrigin } = vi.hoisted(() => ({
  execute: vi.fn(async () => ({ rows: [] })),
  handler: vi.fn(
    async (request: Request) =>
      new Response(`auth:${new URL(request.url).pathname}`),
  ),
  websiteOrigin: "http://localhost:41239",
}));

vi.mock("~/lib/pg-database", () => ({ pgDatabase: { execute } }));
vi.mock("~/lib/auth", () => ({
  auth: {
    options: {
      basePath: "/v1/auth",
      trustedOrigins: [websiteOrigin, "http://localhost:41237"],
    },
    handler,
  },
}));

beforeEach(() => {
  execute.mockClear();
  handler.mockClear();
});

it("exports a Bun-compatible server definition", () => {
  expect(server).toStrictEqual({
    port: serverPort,
    fetch: server.fetch,
  });
});

it("checks the database on the health route", async () => {
  const response = await server.fetch(
    new Request("http://localhost/v1/health"),
  );

  expect(response.status).toBe(200);
  expect(execute).toHaveBeenCalledTimes(1);
  await expect(response.text()).resolves.toBe("OK");
});

it("routes auth requests to better-auth", async () => {
  const response = await server.fetch(
    new Request("http://localhost/v1/auth/sign-in/email", {
      method: "POST",
      headers: { Origin: websiteOrigin },
    }),
  );

  expect(handler).toHaveBeenCalledTimes(1);
  expect(response.headers.get("access-control-allow-origin")).toBe(
    websiteOrigin,
  );
  expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  await expect(response.text()).resolves.toBe("auth:/v1/auth/sign-in/email");
});
