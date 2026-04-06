import type { PropsWithChildren } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { ThemeConnector } from "~/lib/theme-connector";
import type { Route } from "./+types/root";

export function Layout({ children }: PropsWithChildren) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>OpenKitten World</title>
        <Meta />
        <Links />
      </head>
      <body className="m-0 min-h-full bg-background text-foreground antialiased">
        <ThemeConnector />
        <div className="relative min-h-screen overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.12),_transparent_28%)] dark:bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.24),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(96,165,250,0.16),_transparent_30%)]" />
          <main className="relative mx-auto flex min-h-screen w-full max-w-[1280px] items-center justify-center px-4 py-6 sm:px-6 lg:px-10">
            {children}
          </main>
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function HydrateFallback(_: Route.HydrateFallbackProps) {
  return (
    <section className="rounded-3xl border border-border bg-card p-8 text-card-foreground shadow-xl shadow-primary/5">
      <p className="mb-2 mt-0 text-sm font-bold uppercase tracking-[0.06em] text-primary/80">
        Waking Up
      </p>
      <h2 className="mb-4 mt-0 font-heading text-[clamp(1.6rem,2.8vw,2.4rem)] leading-[1.1]">
        Opening your House...
      </h2>
      <p className="m-0 max-w-[64ch] text-base leading-[1.6]">
        OpenKitten World is getting the house ready.
      </p>
    </section>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error) && error.status === 404) {
    message = "404";
    details = "The requested page could not be found.";
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-8 text-card-foreground shadow-xl shadow-primary/5">
      <p className="mb-2 mt-0 text-sm font-bold uppercase tracking-[0.06em] text-primary/80">
        Error
      </p>
      <h2 className="mb-4 mt-0 font-heading text-[clamp(1.6rem,2.8vw,2.4rem)] leading-[1.1]">
        {message}
      </h2>
      <p className="m-0 max-w-[64ch] text-base leading-[1.6]">{details}</p>
      {stack ? (
        <pre className="mt-6 overflow-auto rounded-2xl bg-muted p-4 font-mono text-sm leading-[1.5] whitespace-pre-wrap">
          {stack}
        </pre>
      ) : null}
    </section>
  );
}

export default function Component(_: Route.ComponentProps) {
  return <Outlet />;
}
