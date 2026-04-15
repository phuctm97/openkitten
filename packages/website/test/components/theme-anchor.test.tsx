import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { ThemeAnchor } from "~/components/theme-anchor";

const { setThemeSpy, themeSwitcherSpy, useThemeSpy } = vi.hoisted(() => ({
  setThemeSpy: vi.fn(),
  themeSwitcherSpy: vi.fn(),
  useThemeSpy: vi.fn(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => useThemeSpy(),
}));

vi.mock("~/components/kibo-ui/theme-switcher", () => ({
  ThemeSwitcher: (props: object) => {
    themeSwitcherSpy(props);
    return null;
  },
}));

test("passes the active theme through when it is supported", () => {
  useThemeSpy.mockReturnValue({
    setTheme: setThemeSpy,
    theme: "dark",
  });

  render(<ThemeAnchor />);

  expect(themeSwitcherSpy).toHaveBeenCalledWith({
    className: "fixed right-4 top-4 z-10",
    defaultValue: "system",
    onChange: setThemeSpy,
    value: "dark",
  });
});

test("falls back to system when next-themes returns an unsupported value", () => {
  useThemeSpy.mockReturnValue({
    setTheme: setThemeSpy,
    theme: undefined,
  });

  render(<ThemeAnchor />);

  expect(themeSwitcherSpy).toHaveBeenCalledWith({
    className: "fixed right-4 top-4 z-10",
    defaultValue: "system",
    onChange: setThemeSpy,
    value: "system",
  });
});
