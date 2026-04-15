import type { PropsWithChildren } from "react";

import { ThemeProvider } from "~/components/theme-provider";

import "./layout.css";

export default function Layout({ children }: PropsWithChildren) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
