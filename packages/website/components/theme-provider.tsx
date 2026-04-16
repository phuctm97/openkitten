"use client";

import { ThemeProvider as NextThemes } from "next-themes";
import type { PropsWithChildren } from "react";

import { baseThemeProps } from "~/lib/base-theme-props";

export function ThemeProvider({ children }: PropsWithChildren) {
  return <NextThemes {...baseThemeProps}>{children}</NextThemes>;
}
