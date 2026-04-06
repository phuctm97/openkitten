import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import {
  ThemeSwitcher,
  type ThemeSwitcherProps,
} from "~/components/kibo-ui/theme-switcher";

type ThemeChangeHandler = NonNullable<ThemeSwitcherProps["onChange"]>;

vi.mock("motion/react", () => ({
  motion: {
    div: "div",
  },
}));

test("renders nothing during server rendering before mount", () => {
  const markup = renderToStaticMarkup(<ThemeSwitcher />);

  expect(markup).toBe("");
});

test("renders the three theme options after mount", () => {
  render(<ThemeSwitcher />);

  expect(
    screen.getByRole("button", { name: "System theme" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Light theme" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Dark theme" }),
  ).toBeInTheDocument();
});

test("calls onChange in controlled mode", async () => {
  const user = userEvent.setup();
  const handleChange = vi.fn<ThemeChangeHandler>();

  render(<ThemeSwitcher value="auto" onChange={handleChange} />);

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
