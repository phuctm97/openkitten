import { render, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { afterEach, expect, test, vi } from "vitest";

import { JotaiConnector } from "~/components/jotai-connector";
import { hydrationAtom } from "~/lib/hydration-atom";
import { locationAtom } from "~/lib/location-atom";
import { navigationCountAtom } from "~/lib/navigation-count-atom";
import { navigationDataAtom } from "~/lib/navigation-data-atom";
import { navigatorAtom } from "~/lib/navigator-atom";
import { revalidatorAtom } from "~/lib/revalidator-atom";

const routerMocks = vi.hoisted(() => ({
  useLocation: vi.fn(),
  useNavigate: vi.fn(),
  useNavigation: vi.fn(),
  useRevalidator: vi.fn(),
}));

vi.mock("react-router", async () => {
  const reactRouter =
    await vi.importActual<typeof import("react-router")>("react-router");

  return {
    ...reactRouter,
    useLocation: () => routerMocks.useLocation(),
    useNavigate: () => routerMocks.useNavigate(),
    useNavigation: () => routerMocks.useNavigation(),
    useRevalidator: () => routerMocks.useRevalidator(),
  };
});

function createLocation(pathname: string, search = "", hash = "") {
  return {
    hash,
    key: `${pathname}${search}${hash}`,
    pathname,
    search,
    state: null,
  };
}

function createIdleNavigation() {
  return {
    formAction: undefined,
    formData: undefined,
    formEncType: undefined,
    formMethod: undefined,
    json: undefined,
    location: undefined,
    state: "idle" as const,
    text: undefined,
  };
}

function createSubmittingNavigation(pathname: string) {
  return {
    formAction: pathname,
    formData: new FormData(),
    formEncType: "application/x-www-form-urlencoded" as const,
    formMethod: "POST" as const,
    json: undefined,
    location: createLocation(pathname),
    state: "submitting" as const,
    text: undefined,
  };
}

function createRevalidator(state: "idle" | "loading" = "idle") {
  return {
    revalidate: vi.fn(async () => {}),
    state,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

test("hydrates and keeps the router atoms in sync", async () => {
  const store = createStore();
  const firstLocation = createLocation("/");
  const firstNavigation = createIdleNavigation();
  const firstNavigate = vi.fn();
  const firstRevalidator = createRevalidator();

  routerMocks.useLocation.mockReturnValue(firstLocation);
  routerMocks.useNavigate.mockReturnValue(firstNavigate);
  routerMocks.useNavigation.mockReturnValue(firstNavigation);
  routerMocks.useRevalidator.mockReturnValue(firstRevalidator);

  const { rerender } = render(
    <Provider store={store}>
      <JotaiConnector />
    </Provider>,
  );

  await expect(store.get(hydrationAtom)).resolves.toBeUndefined();
  expect(store.get(locationAtom)).toEqual(firstLocation);
  expect(store.get(navigationDataAtom)).toEqual(firstNavigation);
  expect(store.get(navigationCountAtom)).toBe(1);
  expect(store.get(navigatorAtom)).toEqual({ navigate: firstNavigate });
  expect(store.get(revalidatorAtom)).toEqual(firstRevalidator);

  const secondLocation = createLocation("/game", "?tab=play", "#scene");
  const secondNavigation = createSubmittingNavigation("/game");
  const secondNavigate = vi.fn();
  const secondRevalidator = createRevalidator("loading");

  routerMocks.useLocation.mockReturnValue(secondLocation);
  routerMocks.useNavigate.mockReturnValue(secondNavigate);
  routerMocks.useNavigation.mockReturnValue(secondNavigation);
  routerMocks.useRevalidator.mockReturnValue(secondRevalidator);

  rerender(
    <Provider store={store}>
      <JotaiConnector />
    </Provider>,
  );

  await waitFor(() => {
    expect(store.get(locationAtom)).toEqual(secondLocation);
    expect(store.get(navigationDataAtom)).toEqual(secondNavigation);
    expect(store.get(navigatorAtom)).toEqual({ navigate: secondNavigate });
    expect(store.get(revalidatorAtom)).toEqual(secondRevalidator);
  });

  expect(store.get(navigationCountAtom)).toBe(2);
});
