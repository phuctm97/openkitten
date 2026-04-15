import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import type { Route } from "~/.react-router/types/app/+types/root";

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

  expect(markup).toContain("OpenKitten");
  expect(markup).toContain("Child Content");
  expect(markup).toContain("links-placeholder");
  expect(markup).toContain("meta-placeholder");
  expect(markup).toContain("openkitten-theme");
  expect(markup).toContain("document.documentElement.style.colorScheme");
  expect(markup).toContain("Scroll Restoration Placeholder");
});

test("renders the hydrate fallback", async () => {
  const { HydrateFallback } = await import("~/app/root");

  const { container } = render(
    <HydrateFallback {...rootHydrateFallbackProps} />,
  );

  expect(screen.getByRole("status")).toBeInTheDocument();
  expect(screen.getByText("Loading OpenKitten")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "System theme" }),
  ).toBeInTheDocument();
  expect(container.firstChild).toHaveClass("grid", "min-h-screen");
});

test("renders a 404 error boundary state", async () => {
  const { ErrorBoundary } = await import("~/app/root");

  rootMocks.isRouteErrorResponse.mockReturnValueOnce(true);

  const { container } = render(
    <ErrorBoundary
      error={{ status: 404, statusText: "Not Found" }}
      params={{}}
    />,
  );

  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(screen.getByText("404")).toBeInTheDocument();
  expect(screen.getByText("Not Found")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "System theme" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "The page you are looking for does not exist or may have moved.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Go Home" })).toHaveAttribute(
    "href",
    "/",
  );
  expect(container.firstChild).toHaveClass("grid", "min-h-screen");
});

test("renders the 404 fallback title when status text is missing", async () => {
  const { ErrorBoundary } = await import("~/app/root");

  rootMocks.isRouteErrorResponse.mockReturnValueOnce(true);

  render(<ErrorBoundary error={{ status: 404 }} params={{}} />);

  expect(screen.getByText("404")).toBeInTheDocument();
  expect(screen.getByText("Not Found")).toBeInTheDocument();
  expect(
    screen.getByText(
      "The page you are looking for does not exist or may have moved.",
    ),
  ).toBeInTheDocument();
});

test("renders route error response details for 404 when string data is provided", async () => {
  const { ErrorBoundary } = await import("~/app/root");

  rootMocks.isRouteErrorResponse.mockReturnValueOnce(true);

  render(
    <ErrorBoundary
      error={{
        data: "That page is no longer available.",
        status: 404,
        statusText: "Not Found",
      }}
      params={{}}
    />,
  );

  expect(screen.getByText("404")).toBeInTheDocument();
  expect(screen.getByText("Not Found")).toBeInTheDocument();
  expect(
    screen.getByText("That page is no longer available."),
  ).toBeInTheDocument();
});

test("renders a generic route error boundary state for non-404 responses", async () => {
  const { ErrorBoundary } = await import("~/app/root");

  rootMocks.isRouteErrorResponse.mockReturnValueOnce(true);

  render(<ErrorBoundary error={{ status: 500 }} params={{}} />);

  expect(screen.getByText("500")).toBeInTheDocument();
  expect(screen.getByText("Request Failed")).toBeInTheDocument();
  expect(
    screen.getByText(
      "We ran into an unexpected problem. If it keeps happening, contact us.",
    ),
  ).toBeInTheDocument();
});

test("renders route error response details when status text and string data are provided", async () => {
  const { ErrorBoundary } = await import("~/app/root");

  rootMocks.isRouteErrorResponse.mockReturnValueOnce(true);

  render(
    <ErrorBoundary
      error={{
        data: "Try again in a moment.",
        status: 503,
        statusText: "Service Unavailable",
      }}
      params={{}}
    />,
  );

  expect(screen.getByText("503")).toBeInTheDocument();
  expect(screen.getByText("Service Unavailable")).toBeInTheDocument();
  expect(screen.getByText("Try again in a moment.")).toBeInTheDocument();
});

test("renders the default error state for thrown errors", async () => {
  const { ErrorBoundary } = await import("~/app/root");
  const error = new Error("Cat nap interrupted");

  rootMocks.isRouteErrorResponse.mockReturnValueOnce(false);

  render(<ErrorBoundary error={error} params={{}} />);

  expect(screen.getByText("Error")).toBeInTheDocument();
  expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  expect(
    screen.getByText(
      "We ran into an unexpected problem. If it keeps happening, contact us.",
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText("Cat nap interrupted")).not.toBeInTheDocument();
});

test("renders the default error state for unexpected non-error values", async () => {
  const { ErrorBoundary } = await import("~/app/root");

  rootMocks.isRouteErrorResponse.mockReturnValueOnce(false);

  render(<ErrorBoundary error="not an error object" params={{}} />);

  expect(screen.getByText("Error")).toBeInTheDocument();
  expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  expect(
    screen.getByText(
      "We ran into an unexpected problem. If it keeps happening, contact us.",
    ),
  ).toBeInTheDocument();
});

test("renders a reload button in the error boundary actions", async () => {
  const { ErrorBoundary } = await import("~/app/root");

  rootMocks.isRouteErrorResponse.mockReturnValueOnce(true);

  render(<ErrorBoundary error={{ status: 500 }} params={{}} />);

  expect(
    screen.getByRole("button", { name: "Reload Page" }),
  ).toBeInTheDocument();
});

test("renders the root outlet", async () => {
  const { default: Component } = await import("~/app/root");

  render(<Component {...rootComponentProps} />);

  expect(screen.getByText("Outlet Placeholder")).toBeInTheDocument();
});
