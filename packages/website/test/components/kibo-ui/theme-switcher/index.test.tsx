import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import {
  ThemeSwitcher,
  type ThemeSwitcherProps,
} from "~/components/kibo-ui/theme-switcher";

type ThemeChangeHandler = NonNullable<ThemeSwitcherProps["onChange"]>;

type MockMotionDivProps = ComponentPropsWithoutRef<"div"> & {
  layoutId?: string;
  transition?: object;
};

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
  const markup = renderToStaticMarkup(<ThemeSwitcher />);

  expect(markup).toContain('aria-hidden="true"');
  expect(markup).toContain(
    'class="relative isolate flex h-8 rounded-full bg-background p-1 ring-1 ring-border"',
  );
  expect(markup.match(/data-slot="skeleton"/g)).toHaveLength(3);
  expect(
    markup.match(/class="(?=[^"]*h-6)(?=[^"]*w-6)(?=[^"]*rounded-full)[^"]*"/g),
  ).toHaveLength(3);
  expect(markup).not.toContain('aria-label="System theme"');
});

test("renders the three theme options after mount", () => {
  render(<ThemeSwitcher />);

  expect(
    screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label")),
  ).toEqual(["Light theme", "Dark theme", "System theme"]);
});

test("calls onChange in controlled mode", async () => {
  const user = userEvent.setup();
  const handleChange = vi.fn<ThemeChangeHandler>();

  render(<ThemeSwitcher onChange={handleChange} value="system" />);

  await user.click(screen.getByRole("button", { name: "Dark theme" }));

  expect(handleChange).toHaveBeenCalledWith("dark");
});

test("updates the active theme in uncontrolled mode", async () => {
  const user = userEvent.setup();

  render(<ThemeSwitcher defaultValue="light" />);

  expect(
    screen
      .getByRole("button", { name: "Light theme" })
      .querySelector(".text-foreground"),
  ).not.toBeNull();

  await user.click(screen.getByRole("button", { name: "Dark theme" }));

  expect(
    screen
      .getByRole("button", { name: "Dark theme" })
      .querySelector(".text-foreground"),
  ).not.toBeNull();
});
