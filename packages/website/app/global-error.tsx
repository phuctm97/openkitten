"use client";

import { ErrorState } from "~/components/error-state";
import { ThemeAnchor } from "~/components/theme-anchor";
import { ThemeProvider } from "~/components/theme-provider";
import { Button } from "~/components/ui/button";

export type GlobalErrorProps = Readonly<{
  reset: () => void;
}>;

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="m-0 min-h-full antialiased">
        <ThemeProvider>
          <ThemeAnchor />
          <ErrorState
            badge="Error"
            message="Something went wrong"
            details="We ran into an unexpected problem. If it keeps happening, contact us."
            reload={
              <Button type="button" onClick={reset}>
                Reload Page
              </Button>
            }
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
