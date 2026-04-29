import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mounted: true,
  theme: "light" as "light" | "dark" | "system",
  setTheme: vi.fn(),
}));

vi.mock("@mantine/hooks", () => ({
  useMounted: () => mocks.mounted,
}));

vi.mock("~/hooks/use-theme", () => ({
  useTheme: () => ({ theme: mocks.theme, setTheme: mocks.setTheme }),
}));

vi.mock("motion/react", () => ({
  motion: {
    div: ({
      children,
      ...rest
    }: { children?: ReactNode } & Record<string, unknown>) => (
      <div data-testid="motion-active" {...(rest as ComponentProps<"div">)}>
        {children}
      </div>
    ),
  },
}));

afterEach(() => {
  mocks.mounted = true;
  mocks.theme = "light";
  mocks.setTheme.mockReset();
});

test("renders skeletons before the theme is mounted", async () => {
  mocks.mounted = false;
  const { ThemeSwitcher } = await import("~/lib/theme-switcher");
  const { container } = render(<ThemeSwitcher />);
  expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
});

test("highlights the active theme and renders all theme buttons after mount", async () => {
  mocks.theme = "dark";
  const { ThemeSwitcher } = await import("~/lib/theme-switcher");
  render(<ThemeSwitcher />);
  expect(
    screen.getByRole("button", { name: "Light theme" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Dark theme" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "System theme" }),
  ).toBeInTheDocument();
  expect(screen.getAllByTestId("motion-active")).toHaveLength(1);
});

test("clicking a theme button calls setTheme with that theme key", async () => {
  mocks.theme = "light";
  const { ThemeSwitcher } = await import("~/lib/theme-switcher");
  render(<ThemeSwitcher />);
  fireEvent.click(screen.getByRole("button", { name: "System theme" }));
  expect(mocks.setTheme).toHaveBeenCalledWith("system");
});
