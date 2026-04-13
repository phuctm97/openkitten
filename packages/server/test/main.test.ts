import { describe, expect, it } from "vitest";

import server from "../lib/main";

describe("server", () => {
  it("exports a Bun-compatible server definition", () => {
    expect(server).toStrictEqual({
      fetch: server.fetch,
    });
  });
});
