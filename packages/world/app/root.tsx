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
      <body className="m-0 min-h-full antialiased">
        <ThemeConnector />
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function HydrateFallback(_: Route.HydrateFallbackProps) {
  return (
    <section className="grid min-h-screen px-6 py-10">
      <div className="m-auto max-w-[30rem] space-y-3 rounded-[2rem] border border-border bg-card px-6 py-8 text-center shadow-xs">
        <p className="m-0 text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Booting House
        </p>
        <h2 className="m-0 font-heading text-[clamp(1.8rem,3vw,2.6rem)] leading-[1.1]">
          Opening OpenKitten World...
        </h2>
        <p className="m-0 text-sm leading-[1.7] text-muted-foreground">
          The fullscreen Phaser client is starting up.
        </p>
      </div>
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
    <section className="grid min-h-screen px-6 py-10">
      <div className="m-auto w-full max-w-[42rem] rounded-[2rem] border border-border bg-card p-8 shadow-xs">
        <p className="mb-2 mt-0 text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Error
        </p>
        <h2 className="mb-4 mt-0 font-heading text-[clamp(1.8rem,3vw,2.6rem)] leading-[1.1]">
          {message}
        </h2>
        <p className="m-0 text-base leading-[1.7] text-muted-foreground">
          {details}
        </p>
        {stack ? (
          <pre className="mt-6 overflow-auto rounded-[1.25rem] border border-border bg-muted/50 p-4 font-mono text-sm leading-[1.6] whitespace-pre-wrap">
            {stack}
          </pre>
        ) : null}
      </div>
    </section>
  );
}

export default function Component(_: Route.ComponentProps) {
  return <Outlet />;
}
