import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

function firstOrFail<T>(items: T[]): T {
  const [head] = items;
  if (head === undefined) throw new Error("Expected at least one item");
  return head;
}

const authClientMock = vi.hoisted(() => ({
  organization: {
    listInvitations: vi.fn(),
    cancelInvitation: vi.fn(),
  },
}));

const queryClientMock = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
}));

const toastErrorMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());

vi.mock("~/lib/auth-client", () => ({ authClient: authClientMock }));
vi.mock("~/lib/query-client", () => ({ queryClient: queryClientMock }));
vi.mock("~/lib/toast-error", () => ({ toastError: toastErrorMock }));
vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: vi.fn() },
}));

const { OrganizationInvitationsCard } = await import(
  "~/components/auth/organization-invitations-card"
);

function renderCard(orgId: string, seed?: unknown[]) {
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
  if (seed !== undefined) {
    client.setQueryData(["organizations", "invitations", orgId], seed);
  }
  return render(
    <QueryClientProvider client={client}>
      <OrganizationInvitationsCard organizationId={orgId} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  authClientMock.organization.listInvitations.mockReset();
  authClientMock.organization.cancelInvitation.mockReset();
  queryClientMock.invalidateQueries.mockReset();
  queryClientMock.invalidateQueries.mockResolvedValue(undefined);
  toastErrorMock.mockReset();
  toastSuccessMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

test("renders the loading spinner while invitations load", async () => {
  authClientMock.organization.listInvitations.mockResolvedValue([]);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <OrganizationInvitationsCard organizationId="org_1" />
    </QueryClientProvider>,
  );

  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});

test("renders nothing when there are no pending invitations", async () => {
  const { container } = renderCard("org_1", [
    {
      id: "inv_1",
      email: "a@b",
      role: "member",
      status: "accepted",
      expiresAt: new Date(),
    },
  ]);
  expect(container.firstChild).toBeNull();
});

test("renders nothing when invitations is undefined-like empty", async () => {
  const { container } = renderCard("org_1", []);
  expect(container.firstChild).toBeNull();
});

test("renders pending invitations and cancels with role fallback", async () => {
  authClientMock.organization.cancelInvitation.mockResolvedValueOnce({
    data: {},
  });
  renderCard("org_1", [
    {
      id: "inv_1",
      email: "alice@example.com",
      role: "admin",
      status: "pending",
      expiresAt: new Date("2025-01-15"),
    },
    {
      id: "inv_2",
      email: "bob@example.com",
      role: null,
      status: "pending",
      expiresAt: new Date("2025-02-15"),
    },
  ]);

  expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  expect(screen.getByText("admin")).toBeInTheDocument();
  expect(screen.getByText("member")).toBeInTheDocument();

  const cancelButtons = screen.getAllByRole("button", { name: "Cancel" });
  fireEvent.click(firstOrFail(cancelButtons));

  await waitFor(() => {
    expect(authClientMock.organization.cancelInvitation).toHaveBeenCalledWith({
      invitationId: "inv_1",
      fetchOptions: { throw: true },
    });
  });
  await waitFor(() => {
    expect(toastSuccessMock).toHaveBeenCalledWith("Invitation canceled");
  });
  expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["organizations", "invitations", "org_1"],
  });
});

test("toasts error when cancellation fails", async () => {
  authClientMock.organization.cancelInvitation.mockRejectedValueOnce(
    new Error("nope"),
  );
  renderCard("org_1", [
    {
      id: "inv_1",
      email: "alice@example.com",
      role: "member",
      status: "pending",
      expiresAt: new Date("2025-01-15"),
    },
  ]);

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  await waitFor(() => {
    expect(toastErrorMock).toHaveBeenCalledWith(expect.any(Error));
  });
});
