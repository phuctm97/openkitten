import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("~/components/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}));

import Layout from "~/app/layout";

test("renders the root document shell", () => {
  const markup = renderToStaticMarkup(
    <Layout>
      <span>Kitten</span>
    </Layout>,
  );

  expect(markup).toContain('<html lang="en">');
  expect(markup).toContain("<body>");
  expect(markup).toContain("<span>Kitten</span>");
});

test("marks the document shell as hydration-safe for theme class updates", () => {
  const layout = Layout({
    children: <span>Kitten</span>,
  });

  expect(layout.props.suppressHydrationWarning).toBe(true);
});
