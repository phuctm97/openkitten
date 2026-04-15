import type { Theme } from "~/lib/theme";

export function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light" || value === "system";
}
