import { RouterContextProvider } from "react-router";
import { afterEach, expect, test, vi } from "vitest";

const entryServerMocks = vi.hoisted(() => ({
  handleRequest: vi.fn(),
  isRouteErrorResponse: vi.fn(),
  streamTimeout: 4_950,
}));

vi.mock("@vercel/react-router/entry.server", () => ({
  handleRequest: entryServerMocks.handleRequest,
  streamTimeout: entryServerMocks.streamTimeout,
}));

vi.mock("react-router", async () => {
  const reactRouter =
    await vi.importActual<typeof import("react-router")>("react-router");

  return {
    RouterContextProvider: reactRouter.RouterContextProvider,
    isRouteErrorResponse: entryServerMocks.isRouteErrorResponse,
  };
});

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

test("re-exports the vercel request handler and stream timeout", async () => {
  const entryServer = await import("~/app/entry.server");

  expect(entryServer.default).toBe(entryServerMocks.handleRequest);
  expect(entryServer.streamTimeout).toBe(entryServerMocks.streamTimeout);
});

test("ignores aborted requests", async () => {
  const entryServer = await import("~/app/entry.server");
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const controller = new AbortController();
  const context = new RouterContextProvider();

  controller.abort();

  entryServer.handleError(new Error("aborted"), {
    request: new Request("https://openkitten.test", {
      signal: controller.signal,
    }),
    params: {},
    context,
  });

  expect(errorSpy).not.toHaveBeenCalled();
});

test("ignores 404 route errors", async () => {
  const entryServer = await import("~/app/entry.server");
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const context = new RouterContextProvider();

  entryServerMocks.isRouteErrorResponse.mockReturnValueOnce(true);

  entryServer.handleError(
    { status: 404 },
    {
      request: new Request("https://openkitten.test"),
      params: {},
      context,
    },
  );

  expect(errorSpy).not.toHaveBeenCalled();
});

test("logs non-404 route errors", async () => {
  const entryServer = await import("~/app/entry.server");
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const context = new RouterContextProvider();
  const error = { status: 500 };

  entryServerMocks.isRouteErrorResponse.mockReturnValueOnce(true);

  entryServer.handleError(error, {
    request: new Request("https://openkitten.test"),
    params: {},
    context,
  });

  expect(errorSpy).toHaveBeenCalledWith(error);
});

test("logs unexpected non-route errors", async () => {
  const entryServer = await import("~/app/entry.server");
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const context = new RouterContextProvider();
  const error = new Error("boom");

  entryServerMocks.isRouteErrorResponse.mockReturnValueOnce(false);

  entryServer.handleError(error, {
    request: new Request("https://openkitten.test"),
    params: {},
    context,
  });

  expect(errorSpy).toHaveBeenCalledWith(error);
});
