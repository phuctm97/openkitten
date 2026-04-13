import { beforeEach, describe, expect, it, vi } from "vitest";
import server from "../lib/main";

const { execute } = vi.hoisted(() => ({
  execute: vi.fn(async () => ({ rows: [] })),
}));

vi.mock("~/lib/database", () => ({ database: { execute } }));

describe("server", () => {
  beforeEach(() => {
    execute.mockClear();
  });

  it("exports a Bun-compatible server definition", () => {
    expect(server).toStrictEqual({
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
});
