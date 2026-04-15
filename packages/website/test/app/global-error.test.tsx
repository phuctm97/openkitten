import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("~/components/theme-provider", () => ({
  ThemeProvider: ({ children }: Readonly<{ children: React.ReactNode }>) =>
    children,
}));

vi.mock("~/components/theme-anchor", () => ({
  ThemeAnchor: () => <div data-testid="theme-anchor" />,
}));

import GlobalError from "~/app/global-error";

test("renders the global error document shell", () => {
  const markup = renderToStaticMarkup(<GlobalError reset={() => {}} />);

  expect(markup).toContain('<html lang="en" class="h-full">');
  expect(markup).toContain('<body class="m-0 min-h-full antialiased">');
  expect(markup).toContain('data-testid="theme-anchor"');
  expect(markup).toContain("Something went wrong");
  expect(markup).toContain(
    "We ran into an unexpected problem. If it keeps happening, contact us.",
  );
  expect(markup).toContain("Reload Page");
  expect(markup).toContain('type="button"');
  expect(markup).toContain('href="/"');
  expect(markup).toContain(">Go Home</a>");
});
