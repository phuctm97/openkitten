import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

const { rootProviderSpy } = vi.hoisted(() => ({
  rootProviderSpy: vi.fn(),
}));

vi.mock("fumadocs-ui/provider/next", () => ({
  RootProvider: ({
    children,
    ...props
  }: {
    children: ReactNode;
    theme?: {
      attribute?: string;
      defaultTheme?: string;
      disableTransitionOnChange?: boolean;
      enableColorScheme?: boolean;
      enableSystem?: boolean;
      storageKey?: string;
    };
  }) => {
    rootProviderSpy(props);
    return <div data-testid="root-provider">{children}</div>;
  },
}));

import Layout from "~/app/layout";

test("renders the root document shell", () => {
  const markup = renderToStaticMarkup(
    <Layout params={Promise.resolve({})}>
      <span>Kitten</span>
    </Layout>,
  );

  expect(markup).toContain('<html lang="en" class="h-full">');
  expect(markup).toContain(
    '<body class="m-0 flex min-h-full flex-col antialiased">',
  );
  expect(markup).toContain('data-testid="root-provider"');
  expect(markup).toContain("<span>Kitten</span>");
  expect(rootProviderSpy).toHaveBeenCalledWith({
    theme: {
      attribute: "class",
      defaultTheme: "system",
      disableTransitionOnChange: true,
      enableColorScheme: true,
      enableSystem: true,
      storageKey: "openkitten-theme",
    },
  });
});

test("marks the document shell as hydration-safe for theme class updates", () => {
  const layout = Layout({
    children: <span>Kitten</span>,
    params: Promise.resolve({}),
  });

  expect(layout.props.suppressHydrationWarning).toBe(true);
});
