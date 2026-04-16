import type { ThemeProviderProps } from "next-themes";

export const baseThemeProps = {
  storageKey: "openkitten-theme",
  attribute: "class",
  enableSystem: true,
  defaultTheme: "system",
  enableColorScheme: true,
  disableTransitionOnChange: true,
} satisfies ThemeProviderProps;
