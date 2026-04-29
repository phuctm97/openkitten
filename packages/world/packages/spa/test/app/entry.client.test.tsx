import { afterEach, expect, test, vi } from "vitest";

const entryClientMocks = vi.hoisted(() => ({
  hydrateRoot: vi.fn(),
  hydratedRouter: vi.fn(() => null),
  startTransition: vi.fn((callback: () => void) => {
    callback();
  }),
  applyDefaults: vi.fn(),
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

vi.mock("~/lib/apply-defaults", () => ({
  applyDefaults: entryClientMocks.applyDefaults,
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

test("applies default query and mutation options before hydrating", async () => {
  await import("~/app/entry.client");

  expect(entryClientMocks.applyDefaults).toHaveBeenCalledTimes(1);
  const applyOrder =
    entryClientMocks.applyDefaults.mock.invocationCallOrder[0] ?? Infinity;
  const hydrateOrder =
    entryClientMocks.hydrateRoot.mock.invocationCallOrder[0] ?? -Infinity;
  expect(applyOrder).toBeLessThan(hydrateOrder);
});
