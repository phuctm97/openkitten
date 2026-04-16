import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

const {
  createRelativeLinkSpy,
  generateParamsSpy,
  getMDXComponentsSpy,
  mdxComponentSpy,
  notFoundSpy,
  sourceMock,
  sourceGetPageSpy,
} = vi.hoisted(() => ({
  createRelativeLinkSpy: vi.fn(() => "mock-relative-link"),
  generateParamsSpy: vi.fn(),
  getMDXComponentsSpy: vi.fn((_components?: unknown) => ({
    h1: "mock-heading",
  })),
  mdxComponentSpy: vi.fn(),
  notFoundSpy: vi.fn(),
  sourceMock: {
    generateParams: vi.fn(),
    getPage: vi.fn(),
  },
  sourceGetPageSpy: vi.fn(),
}));

sourceMock.generateParams = generateParamsSpy;
sourceMock.getPage = sourceGetPageSpy;

vi.mock("~/lib/get-mdx-components", () => ({
  getMDXComponents: (components: unknown) => getMDXComponentsSpy(components),
}));

vi.mock("~/lib/source", () => ({
  source: sourceMock,
}));

vi.mock("fumadocs-ui/mdx", () => ({
  createRelativeLink: createRelativeLinkSpy,
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    notFoundSpy();
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("fumadocs-ui/page", () => ({
  DocsBody: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="docs-body">{children}</div>
  ),
  DocsDescription: ({ children }: { children?: React.ReactNode }) =>
    children ? <p>{children}</p> : null,
  DocsPage: ({
    children,
    full,
  }: {
    children: React.ReactNode;
    full?: boolean;
  }) => <article data-full={String(full)}>{children}</article>,
  DocsTitle: ({ children }: { children: React.ReactNode }) => (
    <h1>{children}</h1>
  ),
}));

import DocsCatchAllPage, {
  generateMetadata,
  generateStaticParams,
} from "~/app/docs/[[...slug]]/page";

beforeEach(() => {
  createRelativeLinkSpy.mockClear();
  generateParamsSpy.mockReset();
  getMDXComponentsSpy.mockClear();
  mdxComponentSpy.mockReset();
  notFoundSpy.mockReset();
  sourceGetPageSpy.mockReset();
});

test("renders a docs page from the Fumadocs source", async () => {
  sourceGetPageSpy.mockReturnValue({
    data: {
      body: ({ components }: { components: unknown }) => {
        mdxComponentSpy(components);
        return <p>Generated docs content</p>;
      },
      description: "Where to put docs for OpenKitten.",
      full: true,
      title: "Getting Started",
      toc: [],
    },
  });

  const markup = renderToStaticMarkup(
    await DocsCatchAllPage({
      params: Promise.resolve({
        slug: ["getting-started"],
      }),
      searchParams: Promise.resolve({}),
    }),
  );

  expect(sourceGetPageSpy).toHaveBeenCalledWith(["getting-started"]);
  expect(createRelativeLinkSpy).toHaveBeenCalledWith(sourceMock, {
    data: {
      body: expect.any(Function),
      description: "Where to put docs for OpenKitten.",
      full: true,
      title: "Getting Started",
      toc: [],
    },
  });
  expect(getMDXComponentsSpy).toHaveBeenCalledWith({
    a: "mock-relative-link",
  });
  expect(mdxComponentSpy).toHaveBeenCalledWith({
    h1: "mock-heading",
  });
  expect(markup).toContain('data-full="true"');
  expect(markup).toContain("Getting Started");
  expect(markup).toContain("Where to put docs for OpenKitten.");
  expect(markup).toContain("Generated docs content");
});

test("delegates to Next notFound when the slug is missing", async () => {
  sourceGetPageSpy.mockReturnValue(undefined);

  await expect(
    DocsCatchAllPage({
      params: Promise.resolve({
        slug: ["missing"],
      }),
      searchParams: Promise.resolve({}),
    }),
  ).rejects.toThrow("NEXT_NOT_FOUND");

  expect(notFoundSpy).toHaveBeenCalledTimes(1);
});

test("generates static params from the Fumadocs source", async () => {
  const params = [{ slug: ["getting-started"] }];

  generateParamsSpy.mockReturnValue(params);

  await expect(generateStaticParams()).resolves.toBe(params);
  expect(generateParamsSpy).toHaveBeenCalledTimes(1);
});

test("generates metadata from the Fumadocs page data", async () => {
  sourceGetPageSpy.mockReturnValue({
    data: {
      description: "Where to put docs for OpenKitten.",
      title: "Getting Started",
    },
  });

  await expect(
    generateMetadata({
      params: Promise.resolve({
        slug: ["getting-started"],
      }),
      searchParams: Promise.resolve({}),
    }),
  ).resolves.toEqual({
    description: "Where to put docs for OpenKitten.",
    title: "Getting Started",
  });
});

test("delegates metadata misses to Next notFound", async () => {
  sourceGetPageSpy.mockReturnValue(undefined);

  await expect(
    generateMetadata({
      params: Promise.resolve({
        slug: ["missing"],
      }),
      searchParams: Promise.resolve({}),
    }),
  ).rejects.toThrow("NEXT_NOT_FOUND");

  expect(notFoundSpy).toHaveBeenCalledTimes(1);
});
