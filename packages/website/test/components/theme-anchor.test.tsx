import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import { ThemeAnchor } from "~/components/theme-anchor";

const { setThemeSpy, useThemeSpy } = vi.hoisted(() => ({
  setThemeSpy: vi.fn(),
  useThemeSpy: vi.fn(),
}));

type MockMotionDivProps = ComponentPropsWithoutRef<"div"> & {
  layoutId?: string;
  transition?: object;
};

vi.mock("next-themes", () => ({
  useTheme: () => useThemeSpy(),
}));

vi.mock("motion/react", () => ({
  motion: {
    div: ({
      layoutId: _layoutId,
      transition: _transition,
      ...props
    }: MockMotionDivProps) => <div {...props} />,
  },
}));

test("renders a same-size skeleton during server rendering before mount", () => {
  useThemeSpy.mockReturnValue({
    setTheme: setThemeSpy,
    theme: "system",
  });

  const markup = renderToStaticMarkup(<ThemeAnchor />);

  expect(markup).toContain('aria-hidden="true"');
  expect(markup).toContain(
    'class="isolate fixed right-4 top-4 z-10 flex h-8 rounded-full bg-background p-1 shadow-sm shadow-primary/5 ring-1 ring-border"',
  );
  expect(markup.match(/data-slot="skeleton"/g)).toHaveLength(3);
  expect(
    markup.match(/class="(?=[^"]*h-6)(?=[^"]*w-6)(?=[^"]*rounded-full)[^"]*"/g),
  ).toHaveLength(3);
  expect(markup).not.toContain('aria-label="System theme"');
});

test("renders the three theme options after mount", () => {
  useThemeSpy.mockReturnValue({
    setTheme: setThemeSpy,
    theme: "system",
  });

  render(<ThemeAnchor />);

  expect(
    screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label")),
  ).toEqual(["Light theme", "Dark theme", "System theme"]);
});

test("calls next-themes with the clicked theme", async () => {
  const user = userEvent.setup();

  useThemeSpy.mockReturnValue({
    setTheme: setThemeSpy,
    theme: "system",
  });

  render(<ThemeAnchor />);

  await user.click(screen.getByRole("button", { name: "Dark theme" }));

  expect(setThemeSpy).toHaveBeenCalledWith("dark");
});

test("falls back to system when next-themes returns an unsupported value", () => {
  useThemeSpy.mockReturnValue({
    setTheme: setThemeSpy,
    theme: undefined,
  });

  render(<ThemeAnchor />);

  expect(
    screen
      .getByRole("button", { name: "System theme" })
      .querySelector(".text-foreground"),
  ).not.toBeNull();
});
