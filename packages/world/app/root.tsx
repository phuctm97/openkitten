import type { PropsWithChildren } from "react";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { Route } from "./+types/root";

import "./root.css";

export function Layout({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>OpenKitten World</title>
        <Meta />
        <Links />
      </head>
      <body>
        <div className="app-shell">
          <header className="app-header">
            <div className="brand-block">
              <p className="eyebrow">OpenKitten World</p>
              <h1 className="page-title">Framework Mode Scaffold</h1>
            </div>
            <nav className="app-nav" aria-label="Primary">
              <Link to="/">House</Link>
            </nav>
          </header>
          <main className="app-main">{children}</main>
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function HydrateFallback(_: Route.HydrateFallbackProps) {
  return (
    <section className="route-card">
      <p className="section-label">Waking Up</p>
      <h2 className="section-title">Opening your House...</h2>
      <p className="section-copy">
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
    <section className="route-card">
      <p className="section-label">Error</p>
      <h2 className="section-title">{message}</h2>
      <p className="section-copy">{details}</p>
      {stack ? <pre className="error-stack">{stack}</pre> : null}
    </section>
  );
}

export default function Component(_: Route.ComponentProps) {
  return <Outlet />;
}
