import type { PropsWithChildren } from "react";

import { ThemeAnchor } from "~/components/theme-anchor";
import { ThemeProvider } from "~/components/theme-provider";

import "./layout.css";

export default function Layout({ children }: PropsWithChildren) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="m-0 min-h-full antialiased">
        <ThemeProvider>
          <ThemeAnchor />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
