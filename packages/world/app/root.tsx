import type { PropsWithChildren } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
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
      <body className="m-0 min-h-full bg-[radial-gradient(circle_at_top,var(--card)_0%,var(--muted)_52%,var(--secondary)_100%)] text-foreground antialiased">
        <div className="min-h-screen px-5 py-5 md:px-8 md:py-8">
          <header className="mx-auto mb-8 flex max-w-[960px] flex-col items-start gap-6">
            <div className="grid gap-1">
              <p className="m-0 text-sm font-bold uppercase tracking-[0.08em] text-primary/80">
                OpenKitten World
              </p>
              <h1 className="m-0 font-heading text-[clamp(2rem,4vw,3.2rem)] leading-none">
                Framework Mode Scaffold
              </h1>
            </div>
          </header>
          <main className="mx-auto max-w-[960px]">{children}</main>
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
