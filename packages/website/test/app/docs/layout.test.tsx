import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

const { baseLayoutPropsMock, docsLayoutSpy, getPageTreeSpy } = vi.hoisted(
  () => ({
    baseLayoutPropsMock: {
      nav: { title: "OpenKitten" },
    },
    docsLayoutSpy: vi.fn(),
    getPageTreeSpy: vi.fn(() => ({ id: "docs-tree" })),
  }),
);

vi.mock("~/lib/base-layout-props", () => ({
  baseLayoutProps: baseLayoutPropsMock,
}));

vi.mock("~/lib/source", () => ({
  source: {
    getPageTree: getPageTreeSpy,
  },
}));

vi.mock("fumadocs-ui/layouts/docs", () => ({
  DocsLayout: ({
    children,
    ...props
  }: {
    children: ReactNode;
    tree: { id: string };
  }) => {
    docsLayoutSpy(props);
    return <div data-testid="docs-layout">{children}</div>;
  },
}));

import DocsRootLayout from "~/app/docs/layout";

test("renders the docs layout with the shared options and page tree", () => {
  const markup = renderToStaticMarkup(
    <DocsRootLayout params={Promise.resolve({})}>
      <span>Kitten Docs</span>
    </DocsRootLayout>,
  );

  expect(markup).toContain('data-testid="docs-layout"');
  expect(markup).toContain("<span>Kitten Docs</span>");
  expect(getPageTreeSpy).toHaveBeenCalledWith("en");
  expect(docsLayoutSpy).toHaveBeenCalledWith({
    nav: { title: "OpenKitten" },
    tree: { id: "docs-tree" },
  });
});
