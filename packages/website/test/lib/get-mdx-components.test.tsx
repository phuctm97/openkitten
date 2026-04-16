import type { MDXComponents } from "mdx/types";
import { expect, test, vi } from "vitest";

vi.mock("fumadocs-ui/mdx", () => ({
  default: {
    h1: () => <h1>Default heading</h1>,
    p: () => <p>Default paragraph</p>,
  },
}));

import { getMDXComponents } from "~/lib/get-mdx-components";

test("merges the default Fumadocs MDX components with overrides", () => {
  const customParagraph: NonNullable<MDXComponents["p"]> = () => (
    <p>Custom paragraph</p>
  );
  const components = getMDXComponents({
    p: customParagraph,
  });

  expect(components.h1).toBeTypeOf("function");
  expect(components.p).toBe(customParagraph);
});

test("returns the default Fumadocs MDX components when no overrides are passed", () => {
  const components = getMDXComponents();

  expect(components.h1).toBeTypeOf("function");
  expect(components.p).toBeTypeOf("function");
});
