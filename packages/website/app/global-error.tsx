"use client";

import "./styles.css";

import { ErrorState } from "~/components/error-state";
import { ThemeAnchor } from "~/components/theme-anchor";
import { ThemeProvider } from "~/components/theme-provider";

export default function GlobalError() {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="m-0 flex min-h-full flex-col antialiased">
        <ThemeProvider>
          <ThemeAnchor />
          <ErrorState
            badge="Error"
            message="Something went wrong"
            details="We ran into an unexpected problem. If it keeps happening, contact us."
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
