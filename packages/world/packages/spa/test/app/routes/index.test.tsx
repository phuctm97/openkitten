import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  data: undefined as unknown,
  isPending: false,
  isError: false,
  isRefetching: false,
  error: undefined as unknown,
  refetch: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({
      data: mocks.data,
      isPending: mocks.isPending,
      isError: mocks.isError,
      isRefetching: mocks.isRefetching,
      error: mocks.error,
      refetch: mocks.refetch,
    }),
  };
});

vi.mock("~/components/auth/organization-switcher", () => ({
  OrganizationSwitcher: () => null,
}));

vi.mock("~/components/user/user-button", () => ({
  UserButton: () => null,
}));

vi.mock("~/lib/orpc-utils", () => ({
  orpcUtils: {
    workspace: {
      sync: { queryOptions: () => ({ queryKey: ["workspace", "sync"] }) },
    },
  },
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mocks.data = undefined;
  mocks.isPending = false;
  mocks.isError = false;
  mocks.isRefetching = false;
  mocks.error = undefined;
});

test("renders a spinner while the workspace query is pending", async () => {
  mocks.isPending = true;
  const { default: Component } = await import("~/app/routes/index");
  render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>,
  );
  expect(screen.getByRole("status")).toBeInTheDocument();
});

test("renders the home route with links to app and game once data has loaded", async () => {
  mocks.data = { workspace: { isPersonal: true } };
  const { default: Component } = await import("~/app/routes/index");
  render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>,
  );

  expect(screen.getByText("OpenKitten")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Go to /app" })).toHaveAttribute(
    "href",
    "/app",
  );
  expect(screen.getByRole("link", { name: "Go to /game" })).toHaveAttribute(
    "href",
    "/game",
  );
  expect(screen.getByRole("main")).toHaveClass("grid", "min-h-screen");
});

test("hides the House settings link for a personal workspace", async () => {
  mocks.data = { workspace: { isPersonal: true } };
  const { default: Component } = await import("~/app/routes/index");
  render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>,
  );
  expect(
    screen.queryByRole("link", { name: /House settings/ }),
  ).not.toBeInTheDocument();
});

test("shows the House settings link when the active workspace is not personal", async () => {
  mocks.data = { workspace: { isPersonal: false } };
  const { default: Component } = await import("~/app/routes/index");
  render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>,
  );
  expect(screen.getByRole("link", { name: /House settings/ })).toHaveAttribute(
    "href",
    "/workspace/settings",
  );
});

test("renders the QueryErrorAlert with retry when the query fails", async () => {
  mocks.isError = true;
  mocks.error = new Error("offline");
  const { default: Component } = await import("~/app/routes/index");
  render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>,
  );
  expect(screen.getByText("Couldn't load this house")).toBeInTheDocument();
  expect(screen.getByText("offline")).toBeInTheDocument();
  screen.getByRole("button", { name: /retry/i }).click();
  expect(mocks.refetch).toHaveBeenCalledTimes(1);
});
