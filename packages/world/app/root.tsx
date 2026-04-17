import { QueryClientProvider } from "@tanstack/react-query";
import { getDefaultStore } from "jotai";
import type { PropsWithChildren } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { Route } from "~/.react-router/types/app/+types/root";
import { JotaiConnector } from "~/components/jotai-connector";
import { ThemeAnchor } from "~/components/theme-anchor";
import { ThemeConnector } from "~/components/theme-connector";
import { ThemeInitializer } from "~/components/theme-initializer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Devtools } from "~/lib/devtools";
import { hydrationAtom } from "~/lib/hydration-atom";
import { queryClient } from "~/lib/query-client";

export const clientMiddleware: Route.ClientMiddlewareFunction[] = [
  async () => {
    const store = getDefaultStore();
    await store.get(hydrationAtom);
  },
];

export function Layout({ children }: PropsWithChildren) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <ThemeInitializer />
        <title>OpenKitten</title>
        <Meta />
        <Links />
      </head>
      <body className="m-0 min-h-full antialiased">
        <QueryClientProvider client={queryClient}>
          <JotaiConnector />
          <ThemeConnector />
          <ThemeAnchor />
          {children}
          {import.meta.env.DEV && <Devtools />}
        </QueryClientProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function HydrateFallback(_: Route.HydrateFallbackProps) {
  return (
    <section className="grid min-h-screen place-items-center bg-background px-6 py-10">
      <div
        role="status"
        aria-live="polite"
        className="flex w-full max-w-sm flex-col items-center gap-4 text-center"
      >
        <div className="flex size-14 items-center justify-center rounded-full border border-border bg-muted/50">
          <span className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
        <p className="m-0 text-sm leading-6 text-muted-foreground">
          Loading OpenKitten
        </p>
      </div>
    </section>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let badge = "Error";
  let message = "Something went wrong";
  let details =
    "We ran into an unexpected problem. If it keeps happening, contact us.";

  if (isRouteErrorResponse(error)) {
    badge = error.status.toString();

    if (error.status === 404) {
      message = error.statusText || "Not Found";
      if (typeof error.data === "string" && error.data.length > 0) {
        details = error.data;
      } else {
        details =
          "The page you are looking for does not exist or may have moved.";
      }
    } else {
      message = error.statusText || "Request Failed";
      if (typeof error.data === "string" && error.data.length > 0) {
        details = error.data;
      }
    }
  }

  return (
    <section className="relative grid min-h-screen overflow-hidden bg-background px-6 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-40 [mask-image:radial-gradient(circle_at_center,black,transparent_78%)]" />
        <div className="absolute left-[-8rem] top-[-6rem] size-80 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-6rem] size-96 rounded-full bg-accent/60 blur-3xl" />
      </div>
      <div
        role="alert"
        className="relative m-auto w-full max-w-[44rem] rounded-[2rem] bg-card p-8 shadow-sm shadow-primary/5 ring-1 ring-border/50"
      >
        <Badge variant="outline">{badge}</Badge>
        <h2 className="mb-3 mt-5 font-heading text-[clamp(1.8rem,3vw,2.7rem)] leading-[1.1]">
          {message}
        </h2>
        <p className="m-0 max-w-[60ch] text-base leading-[1.7] text-muted-foreground">
          {details}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <form className="contents">
            <Button type="submit">Reload Page</Button>
          </form>
          <Button variant="outline" asChild>
            <a href="/">Go Home</a>
          </Button>
        </div>
      </div>
    </section>
  );
}

export default function Component(_: Route.ComponentProps) {
  return <Outlet />;
}
