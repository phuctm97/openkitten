import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  workspaceData: undefined as unknown,
  workspaceIsLoading: false,
  workspaceIsError: false,
}));

vi.mock("~/lib/authenticate", () => ({
  authenticate: mocks.authenticate,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({
      data: mocks.workspaceData,
      isLoading: mocks.workspaceIsLoading,
      isError: mocks.workspaceIsError,
    }),
  };
});

vi.mock("~/lib/rpc-query", () => ({
  rpcQuery: {
    workspace: {
      sync: { queryOptions: () => ({ queryKey: ["workspace", "sync"] }) },
    },
  },
}));

vi.mock("~/components/auth/organization-switcher", () => ({
  OrganizationSwitcher: () => <div data-testid="switcher" />,
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mocks.workspaceData = undefined;
  mocks.workspaceIsLoading = false;
  mocks.workspaceIsError = false;
});

function renderRoute(initialPath: string, ChildComponent?: () => ReactNode) {
  return import("~/app/routes/workspace").then(({ default: Component }) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/workspace" element={<Component />}>
              <Route
                path="members"
                element={ChildComponent ? <ChildComponent /> : <Outlet />}
              />
              <Route
                path="settings"
                element={ChildComponent ? <ChildComponent /> : <Outlet />}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
}

test("clientLoader authenticates and returns null when on a child path", async () => {
  mocks.authenticate.mockResolvedValueOnce(undefined);
  const { clientLoader } = await import("~/app/routes/workspace");
  await expect(
    clientLoader({
      request: new Request("http://localhost/workspace/members"),
    } as never),
  ).resolves.toBeNull();
});

test("clientLoader redirects /workspace to /workspace/members", async () => {
  mocks.authenticate.mockResolvedValueOnce(undefined);
  const { clientLoader } = await import("~/app/routes/workspace");
  await expect(
    clientLoader({
      request: new Request("http://localhost/workspace"),
    } as never),
  ).rejects.toMatchObject({ status: 302 });
});

test("clientLoader redirects /workspace/ (with trailing slash) to /workspace/members", async () => {
  mocks.authenticate.mockResolvedValueOnce(undefined);
  const { clientLoader } = await import("~/app/routes/workspace");
  await expect(
    clientLoader({
      request: new Request("http://localhost/workspace/"),
    } as never),
  ).rejects.toMatchObject({ status: 302 });
});

test("renders a spinner while the workspace query is loading", async () => {
  mocks.workspaceIsLoading = true;
  await renderRoute("/workspace/members");
  expect(screen.getByRole("status")).toBeInTheDocument();
});

test("renders the personal-house alert with the members message on /workspace/members", async () => {
  mocks.workspaceData = {
    workspace: { isPersonal: true },
    house: { id: "house_1", name: "Ada's House" },
  };
  await renderRoute("/workspace/members");
  expect(screen.getByText("Personal house")).toBeInTheDocument();
  expect(
    screen.getByText(/Members are only available for collaborative houses/),
  ).toBeInTheDocument();
});

test("renders the personal-house alert with the settings message on /workspace/settings", async () => {
  mocks.workspaceData = {
    workspace: { isPersonal: true },
    house: { id: "house_1", name: "Ada's House" },
  };
  await renderRoute("/workspace/settings");
  expect(
    screen.getByText(
      /House settings are only available for collaborative houses/,
    ),
  ).toBeInTheDocument();
});

test("renders the outlet for a non-personal house with the house name and switcher", async () => {
  mocks.workspaceData = {
    workspace: { isPersonal: false },
    house: { id: "house_1", name: "Acme" },
  };
  await renderRoute("/workspace/members", () => <div data-testid="child" />);
  expect(screen.getByText("Acme")).toBeInTheDocument();
  expect(screen.getByTestId("switcher")).toBeInTheDocument();
  expect(screen.getByTestId("child")).toBeInTheDocument();
});

test("renders an error alert when the workspace query fails", async () => {
  mocks.workspaceIsError = true;
  await renderRoute("/workspace/members");
  expect(screen.getByText("Couldn't load this house")).toBeInTheDocument();
});

test("renders an error alert when no data is available and the query is not loading", async () => {
  mocks.workspaceData = undefined;
  mocks.workspaceIsLoading = false;
  await renderRoute("/workspace/members");
  expect(screen.getByText("Couldn't load this house")).toBeInTheDocument();
});
