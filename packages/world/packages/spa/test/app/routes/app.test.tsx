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

vi.mock("~/lib/app-sidebar", () => ({
  AppSidebar: ({ houseName }: { houseName: string }) => (
    <aside data-testid="app-sidebar">{houseName}</aside>
  ),
}));

vi.mock("~/lib/orpc-utils", () => ({
  orpcUtils: {
    workspace: {
      sync: { queryOptions: () => ({ queryKey: ["workspace", "sync"] }) },
    },
  },
}));

const baseData = {
  house: {
    id: "house-1",
    name: "Ada's House",
    slug: "ada-house",
    logo: null,
    metadata: null,
    createdAt: new Date(),
  },
  workspace: {
    id: 1,
    userId: "user-1",
    houseId: "house-1",
    isPersonal: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  members: [],
  invitations: [],
  activeMember: { id: "m-1", role: "owner", createdAt: new Date() },
};

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
  const { default: Component } = await import("~/app/routes/app");
  render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>,
  );
  expect(screen.getByRole("status")).toBeInTheDocument();
});

test("renders the sidebar shell with the house name once loaded", async () => {
  mocks.data = baseData;
  const { default: Component } = await import("~/app/routes/app");
  render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>,
  );
  expect(screen.getByTestId("app-sidebar")).toHaveTextContent("Ada's House");
  expect(screen.getByText("Personal")).toBeInTheDocument();
});

test("renders Team label for non-personal workspaces", async () => {
  mocks.data = {
    ...baseData,
    workspace: { ...baseData.workspace, isPersonal: false },
  };
  const { default: Component } = await import("~/app/routes/app");
  render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>,
  );
  expect(screen.getByText("Team")).toBeInTheDocument();
});

test("renders the QueryErrorAlert with retry when the query fails", async () => {
  mocks.isError = true;
  mocks.error = new Error("offline");
  const { default: Component } = await import("~/app/routes/app");
  render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>,
  );
  expect(screen.getByText("Couldn't load this house")).toBeInTheDocument();
  screen.getByRole("button", { name: /retry/i }).click();
  expect(mocks.refetch).toHaveBeenCalledTimes(1);
});
