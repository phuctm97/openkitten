import { isColorScheme } from "~/lib/is-color-scheme";
import type { Theme } from "~/lib/theme";

export function isTheme(value: unknown): value is Theme {
  return isColorScheme(value) || value === "system";
}
