"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { PropsWithChildren } from "react";

export function ThemeProvider({ children }: PropsWithChildren) {
  return (
    <NextThemesProvider
      attribute="class"
      disableTransitionOnChange
      storageKey="openkitten-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
