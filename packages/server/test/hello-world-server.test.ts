import { describe, expect, it } from "vitest";

import server from "../lib/main";

describe("server", () => {
  it("returns hello world on the root route", async () => {
    const response = await server.fetch(new Request("http://localhost/"));

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("Hello, world!");
  });
});
