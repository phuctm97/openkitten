"use client";

import { useTheme } from "next-themes";

import { ThemeSwitcher } from "~/components/kibo-ui/theme-switcher";
import { isTheme } from "~/lib/is-theme";
import type { Theme } from "~/lib/theme";

export function ThemeAnchor() {
  const { setTheme, theme } = useTheme();

  const activeTheme: Theme = isTheme(theme) ? theme : "system";

  return (
    <ThemeSwitcher
      defaultValue="system"
      value={activeTheme}
      onChange={setTheme}
      className="fixed right-4 top-4 z-10"
    />
  );
}
