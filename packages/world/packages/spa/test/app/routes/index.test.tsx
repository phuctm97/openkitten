import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";

const queryDataMock = vi.hoisted(() => ({ value: undefined as unknown }));

vi.mock("~/components/auth/organization-switcher", () => ({
  OrganizationSwitcher: () => null,
}));

vi.mock("~/components/user/user-button", () => ({
  UserButton: () => null,
}));

vi.mock("~/lib/rpc-query", () => ({
  rpcQuery: {
    workspace: {
      sync: {
        queryOptions: () => ({
          queryKey: ["workspace", "sync"],
          queryFn: async () => queryDataMock.value,
          enabled: false,
        }),
      },
    },
  },
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  queryDataMock.value = undefined;
});

function renderWithProviders(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  if (queryDataMock.value !== undefined) {
    client.setQueryData(["workspace", "sync"], queryDataMock.value);
  }
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

test("renders the home route with links to app and game", async () => {
  const { default: Component } = await import("~/app/routes/index");

  renderWithProviders(<Component />);

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

test("hides the House settings link by default (personal workspace)", async () => {
  const { default: Component } = await import("~/app/routes/index");
  renderWithProviders(<Component />);
  expect(
    screen.queryByRole("link", { name: /House settings/ }),
  ).not.toBeInTheDocument();
});

test("shows the House settings link when the active workspace is not personal", async () => {
  queryDataMock.value = { workspace: { isPersonal: false } };
  const { default: Component } = await import("~/app/routes/index");
  renderWithProviders(<Component />);
  expect(screen.getByRole("link", { name: /House settings/ })).toHaveAttribute(
    "href",
    "/workspace/settings",
  );
});
