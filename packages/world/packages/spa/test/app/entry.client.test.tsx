import { afterEach, expect, test, vi } from "vitest";

const entryClientMocks = vi.hoisted(() => ({
  hydrateRoot: vi.fn(),
  hydratedRouter: vi.fn(() => null),
  startTransition: vi.fn((callback: () => void) => {
    callback();
  }),
}));

vi.mock("react", async () => {
  const react = await vi.importActual<typeof import("react")>("react");

  return {
    ...react,
    startTransition: entryClientMocks.startTransition,
  };
});

vi.mock("react-dom/client", () => ({
  hydrateRoot: entryClientMocks.hydrateRoot,
}));

vi.mock("react-router/dom", () => ({
  HydratedRouter: entryClientMocks.hydratedRouter,
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

test("hydrates the app inside a transition", async () => {
  await import("~/app/entry.client");

  expect(entryClientMocks.startTransition).toHaveBeenCalledTimes(1);
  expect(entryClientMocks.hydrateRoot).toHaveBeenCalledTimes(1);
  expect(entryClientMocks.hydrateRoot.mock.calls[0]?.[0]).toBe(document);
  expect(entryClientMocks.hydrateRoot.mock.calls[0]?.[1]).toBeTruthy();
});
