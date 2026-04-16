import { beforeEach, expect, test, vi } from "vitest";

const { createFromSourceSpy } = vi.hoisted(() => ({
  createFromSourceSpy: vi.fn(),
}));

const source = {
  pageTree: { id: "docs-tree" },
};

vi.mock("~/lib/source", () => ({
  source,
}));

vi.mock("fumadocs-core/search/server", () => ({
  createFromSource: createFromSourceSpy,
}));

beforeEach(() => {
  createFromSourceSpy.mockReset();
  vi.resetModules();
});

test("creates the search route from the Fumadocs source", async () => {
  const getHandler = vi.fn();

  createFromSourceSpy.mockReturnValue({
    GET: getHandler,
  });

  const { GET } = await import("~/app/api/search/route");

  expect(createFromSourceSpy).toHaveBeenCalledWith(source, {
    language: "english",
  });
  expect(GET).toBe(getHandler);
});
