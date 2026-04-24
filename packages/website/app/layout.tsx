import "./styles.css";

import { RootProvider } from "fumadocs-ui/provider/next";

import { Toaster } from "~/components/ui/sonner";
import { TooltipProvider } from "~/components/ui/tooltip";
import { baseThemeProps } from "~/lib/base-theme-props";

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="m-0 flex min-h-full flex-col antialiased">
        <RootProvider theme={baseThemeProps}>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </RootProvider>
      </body>
    </html>
  );
}
