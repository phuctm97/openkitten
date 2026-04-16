import { beforeEach, expect, test, vi } from "vitest";

const { loaderSpy, toFumadocsSourceSpy } = vi.hoisted(() => ({
  loaderSpy: vi.fn(),
  toFumadocsSourceSpy: vi.fn(),
}));

vi.mock("~/.source/server", () => ({
  docs: {
    toFumadocsSource: toFumadocsSourceSpy,
  },
}));

vi.mock("fumadocs-core/source", () => ({
  loader: loaderSpy,
}));

beforeEach(() => {
  loaderSpy.mockReset();
  toFumadocsSourceSpy.mockReset();
  vi.resetModules();
});

test("creates a Fumadocs loader output from the docs collection", async () => {
  const docsCollection = { files: [] };
  const loadedSource = { pageTree: { id: "docs-tree" } };

  toFumadocsSourceSpy.mockReturnValue(docsCollection);
  loaderSpy.mockReturnValue(loadedSource);

  const { source } = await import("~/lib/source");

  expect(toFumadocsSourceSpy).toHaveBeenCalledTimes(1);
  expect(loaderSpy).toHaveBeenCalledWith({
    baseUrl: "/docs",
    source: docsCollection,
  });
  expect(source).toBe(loadedSource);
});
