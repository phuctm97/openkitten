import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getDefaultStore } from "jotai/vanilla";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { revalidatorAtom } from "~/lib/revalidator-atom";

function lastOrFail<T>(items: T[]): T {
  const tail = items[items.length - 1];
  if (tail === undefined) throw new Error("Expected at least one item");
  return tail;
}

const authClientMock = vi.hoisted(() => ({
  useSession: vi.fn(),
  organization: {
    list: vi.fn(),
    setActive: vi.fn(),
  },
}));

const queryClientMock = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  resetQueries: vi.fn(),
}));

const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock("~/lib/auth-client", () => ({ authClient: authClientMock }));
vi.mock("~/lib/query-client", () => ({ queryClient: queryClientMock }));
vi.mock("~/lib/toast-error", () => ({ toastError: toastErrorMock }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("~/components/auth/create-organization-dialog", () => ({
  CreateOrganizationDialog: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="create-dialog">
        <button
          type="button"
          data-testid="create-close"
          onClick={() => onOpenChange(false)}
        />
      </div>
    ) : null,
}));

vi.mock("~/components/ui/dropdown-menu", async () => {
  return {
    DropdownMenu: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DropdownMenuTrigger: ({
      children,
    }: {
      asChild?: boolean;
      children: ReactNode;
    }) => <>{children}</>,
    DropdownMenuContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DropdownMenuItem: ({
      onSelect,
      children,
    }: {
      onSelect?: () => void;
      children: ReactNode;
    }) => (
      <button type="button" onClick={onSelect}>
        {children}
      </button>
    ),
    DropdownMenuSeparator: () => <hr />,
  };
});

const { OrganizationSwitcher } = await import(
  "~/components/auth/organization-switcher"
);

type Org = { id: string; name: string };

function setup(opts: {
  activeOrganizationId?: string | null;
  orgs?: Org[];
  isLoading?: boolean;
}) {
  authClientMock.useSession.mockReturnValue({
    data: opts.activeOrganizationId
      ? {
          session: { activeOrganizationId: opts.activeOrganizationId },
        }
      : null,
  });
  authClientMock.organization.list.mockResolvedValue(opts.orgs ?? []);

  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
  if (!opts.isLoading) {
    client.setQueryData(["organizations", "list"], opts.orgs ?? []);
  }
  return render(
    <QueryClientProvider client={client}>
      <OrganizationSwitcher className="extra" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  authClientMock.useSession.mockReset();
  authClientMock.organization.list.mockReset();
  authClientMock.organization.setActive.mockReset();
  queryClientMock.invalidateQueries.mockReset();
  queryClientMock.invalidateQueries.mockResolvedValue(undefined);
  queryClientMock.resetQueries.mockReset();
  queryClientMock.resetQueries.mockResolvedValue(undefined);
  toastErrorMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

test("shows Loading label when query is pending", async () => {
  authClientMock.useSession.mockReturnValue({ data: null });
  authClientMock.organization.list.mockResolvedValue([]);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <OrganizationSwitcher />
    </QueryClientProvider>,
  );

  expect(screen.getByText("Loading...")).toBeInTheDocument();
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});

test("falls back to first org when active org id is not in list", async () => {
  setup({
    activeOrganizationId: "missing",
    orgs: [
      { id: "org_1", name: "Acme" },
      { id: "org_2", name: "Beta" },
    ],
  });
  expect(screen.getAllByText("Acme").length).toBeGreaterThanOrEqual(1);
});

test("renders the active org and switches when an item is selected, showing pending spinner", async () => {
  let resolveSet: (value: unknown) => void = () => {};
  authClientMock.organization.setActive.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveSet = resolve;
    }),
  );

  const revalidate = vi.fn(async () => {});
  getDefaultStore().set(revalidatorAtom, { revalidate, state: "idle" });

  setup({
    activeOrganizationId: "org_2",
    orgs: [
      { id: "org_1", name: "Acme" },
      { id: "org_2", name: "Beta" },
    ],
  });

  const acmeButtons = screen.getAllByRole("button", { name: "Acme" });
  fireEvent.click(lastOrFail(acmeButtons));

  await waitFor(() => {
    expect(authClientMock.organization.setActive).toHaveBeenCalledWith({
      organizationId: "org_1",
      fetchOptions: { throw: true },
    });
  });
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();

  resolveSet({ data: {} });

  await waitFor(() => {
    expect(queryClientMock.resetQueries).toHaveBeenCalledWith();
  });
  expect(revalidate).toHaveBeenCalledTimes(1);
});

test("toasts error when setActive fails", async () => {
  authClientMock.organization.setActive.mockRejectedValueOnce(
    new Error("nope"),
  );
  setup({
    activeOrganizationId: "org_2",
    orgs: [
      { id: "org_1", name: "Acme" },
      { id: "org_2", name: "Beta" },
    ],
  });

  const acmeButtons = screen.getAllByRole("button", { name: "Acme" });
  fireEvent.click(lastOrFail(acmeButtons));

  await waitFor(() => {
    expect(toastErrorMock).toHaveBeenCalledWith(expect.any(Error));
  });
});

test("opens and closes create dialog from the menu item", async () => {
  setup({ activeOrganizationId: null, orgs: [] });

  fireEvent.click(screen.getByRole("button", { name: /Create house/ }));
  expect(screen.getByTestId("create-dialog")).toBeInTheDocument();

  fireEvent.click(screen.getByTestId("create-close"));
  expect(screen.queryByTestId("create-dialog")).toBeNull();
});

test("renders without session and without orgs", async () => {
  setup({ activeOrganizationId: null, orgs: undefined });

  expect(screen.getByText("Loading...")).toBeInTheDocument();
});
