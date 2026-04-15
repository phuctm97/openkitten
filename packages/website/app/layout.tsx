import type { PropsWithChildren } from "react";

import { ThemeAnchor } from "~/components/theme-anchor";
import { ThemeProvider } from "~/components/theme-provider";

import "./layout.css";

export default function Layout({ children }: PropsWithChildren) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ThemeAnchor />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
