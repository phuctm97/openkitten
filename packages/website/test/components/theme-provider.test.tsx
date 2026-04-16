import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";

import { ThemeProvider } from "~/components/theme-provider";

const { nextThemesProviderSpy } = vi.hoisted(() => ({
  nextThemesProviderSpy: vi.fn(),
}));

vi.mock("next-themes", () => ({
  ThemeProvider: ({
    attribute,
    children,
    defaultTheme,
    disableTransitionOnChange,
    enableColorScheme,
    enableSystem,
    storageKey,
  }: {
    attribute?: string;
    children: ReactNode;
    defaultTheme?: string;
    disableTransitionOnChange?: boolean;
    enableColorScheme?: boolean;
    enableSystem?: boolean;
    storageKey?: string;
  }) => {
    nextThemesProviderSpy({
      attribute,
      defaultTheme,
      disableTransitionOnChange,
      enableColorScheme,
      enableSystem,
      storageKey,
    });

    return <div data-testid="next-themes-provider">{children}</div>;
  },
}));

test("configures next-themes for class-based system theming", () => {
  render(
    <ThemeProvider>
      <span>Kitten</span>
    </ThemeProvider>,
  );

  expect(screen.getByTestId("next-themes-provider")).toHaveTextContent(
    "Kitten",
  );
  expect(nextThemesProviderSpy).toHaveBeenCalledWith({
    attribute: "class",
    disableTransitionOnChange: true,
    defaultTheme: "system",
    enableColorScheme: true,
    enableSystem: true,
    storageKey: "openkitten-theme",
  });
});
