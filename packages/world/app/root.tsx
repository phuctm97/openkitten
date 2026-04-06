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
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <Meta />
        <Links />
      </head>
      <body className="m-0 min-h-full bg-background text-foreground antialiased">
        <ThemeConnector />
        <div className="app-shell">
          <header className="app-shell__header">
            <div className="app-shell__title-wrap">
              <p className="app-shell__eyebrow">OpenKitten World</p>
              <h1 className="app-shell__title">
                One small House, alive and readable.
              </h1>
              <p className="app-shell__summary">
                The MVP is a fixed Lantern House slice with Mochi, Pepper,
                notices, threads, and one active session.
              </p>
            </div>
          </header>
          <main className="app-shell__main">{children}</main>
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function HydrateFallback(_: Route.HydrateFallbackProps) {
  return (
    <section className="fallback-card">
      <p className="fallback-card__eyebrow">Waking Up</p>
      <h2 className="fallback-card__title">Lighting the room...</h2>
      <p className="fallback-card__body">
        OpenKitten World is setting the desk lamp, the whiteboard, and the first
        cats in place.
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
    <section className="fallback-card">
      <p className="fallback-card__eyebrow">Error</p>
      <h2 className="fallback-card__title">{message}</h2>
      <p className="fallback-card__body">{details}</p>
      {stack ? <pre className="fallback-card__stack">{stack}</pre> : null}
    </section>
  );
}

export default function Component(_: Route.ComponentProps) {
  return <Outlet />;
}
