import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import type { Route } from "../../.react-router/types/app/+types/root";

const rootMocks = vi.hoisted(() => ({
  isRouteErrorResponse: vi.fn(),
}));

vi.mock("react-router", async () => {
  const react = await vi.importActual<typeof import("react")>("react");

  return {
    isRouteErrorResponse: rootMocks.isRouteErrorResponse,
    Links: () => react.createElement("meta", { content: "links-placeholder" }),
    Meta: () => react.createElement("meta", { content: "meta-placeholder" }),
    Outlet: () => react.createElement("div", null, "Outlet Placeholder"),
    Scripts: () => react.createElement("script", { type: "application/json" }),
    ScrollRestoration: () =>
      react.createElement("div", null, "Scroll Restoration Placeholder"),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

const rootComponentProps = {
  loaderData: undefined,
  matches: [
    {
      id: "root",
      params: {},
      pathname: "/",
      data: undefined,
      loaderData: undefined,
      handle: undefined,
    },
  ],
  params: {},
} satisfies Route.ComponentProps;

const rootHydrateFallbackProps = {
  params: {},
} satisfies Route.HydrateFallbackProps;

test("renders the document shell and shared layout", async () => {
  const { Layout } = await import("~/app/root");
  const markup = renderToStaticMarkup(
    <Layout>
      <span>Child Content</span>
    </Layout>,
  );

  expect(markup).toContain("OpenKitten World");
  expect(markup).toContain("Child Content");
  expect(markup).toContain("links-placeholder");
  expect(markup).toContain("meta-placeholder");
  expect(markup).toContain("Scroll Restoration Placeholder");
});

test("renders the hydrate fallback", async () => {
  const { HydrateFallback } = await import("~/app/root");

  const { container } = render(
    <HydrateFallback {...rootHydrateFallbackProps} />,
  );

  expect(screen.getByText("Opening OpenKitten World...")).toBeInTheDocument();
  expect(
    screen.getByText("The fullscreen Phaser client is starting up."),
  ).toBeInTheDocument();
  expect(container.firstChild).toHaveClass("grid", "min-h-screen");
});

test("renders a 404 error boundary state", async () => {
  const { ErrorBoundary } = await import("~/app/root");

  rootMocks.isRouteErrorResponse.mockReturnValueOnce(true);

  const { container } = render(
    <ErrorBoundary error={{ status: 404 }} params={{}} />,
  );

  expect(screen.getByText("404")).toBeInTheDocument();
  expect(
    screen.getByText("The requested page could not be found."),
  ).toBeInTheDocument();
  expect(container.firstChild).toHaveClass("grid", "min-h-screen");
});

test("renders a generic route error boundary state for non-404 responses", async () => {
  const { ErrorBoundary } = await import("~/app/root");

  rootMocks.isRouteErrorResponse.mockReturnValueOnce(true);

  render(<ErrorBoundary error={{ status: 500 }} params={{}} />);

  expect(screen.getByText("Oops!")).toBeInTheDocument();
  expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument();
});

test("renders the development error message and stack for thrown errors", async () => {
  const { ErrorBoundary } = await import("~/app/root");
  const error = new Error("Cat nap interrupted");

  rootMocks.isRouteErrorResponse.mockReturnValueOnce(false);

  render(<ErrorBoundary error={error} params={{}} />);

  expect(screen.getByText("Cat nap interrupted")).toBeInTheDocument();
  expect(screen.getByText(/Error: Cat nap interrupted/)).toBeInTheDocument();
});

test("renders the root outlet", async () => {
  const { default: Component } = await import("~/app/root");

  render(<Component {...rootComponentProps} />);

  expect(screen.getByText("Outlet Placeholder")).toBeInTheDocument();
});
