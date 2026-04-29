import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const authClientMock = vi.hoisted(() => ({
  organization: {
    acceptInvitation: vi.fn(),
    rejectInvitation: vi.fn(),
    getInvitation: vi.fn(),
  },
}));

const navigateMock = vi.hoisted(() => vi.fn());

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
vi.mock("~/lib/navigate-atom", async () => {
  const { atom } = await import("jotai");
  return {
    navigateAtom: atom(null, (_get, _set, ...args: unknown[]) =>
      navigateMock(...args),
    ),
  };
});

const { AcceptInvitationCard } = await import(
  "~/components/auth/accept-invitation-card"
);

function renderWith(invitationId: string, seed?: { data?: unknown }) {
  authClientMock.organization.getInvitation.mockResolvedValue(
    seed?.data ?? { organizationName: "Default" },
  );
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
  if (seed?.data !== undefined) {
    client.setQueryData(
      ["organizations", "invitation", invitationId],
      seed.data,
    );
  }
  const store = createStore();
  return render(
    <QueryClientProvider client={client}>
      <Provider store={store}>
        <AcceptInvitationCard invitationId={invitationId} className="extra" />
      </Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  authClientMock.organization.acceptInvitation.mockReset();
  authClientMock.organization.rejectInvitation.mockReset();
  navigateMock.mockReset();
  queryClientMock.invalidateQueries.mockReset();
  queryClientMock.invalidateQueries.mockResolvedValue(undefined);
  toastErrorMock.mockReset();
  toastSuccessMock.mockReset();
  navigateMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

test("renders the loading spinner while invitation is loading", async () => {
  authClientMock.organization.acceptInvitation.mockResolvedValue({});
  authClientMock.organization.rejectInvitation.mockResolvedValue({});
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <Provider store={createStore()}>
        <AcceptInvitationCard invitationId="inv_1" />
      </Provider>
    </QueryClientProvider>,
  );

  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});

test("renders error card with message when query errors", async () => {
  authClientMock.organization.getInvitation.mockRejectedValueOnce(
    new Error("Boom"),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <Provider store={createStore()}>
        <AcceptInvitationCard invitationId="inv_1" />
      </Provider>
    </QueryClientProvider>,
  );

  await waitFor(() => {
    expect(screen.getByText("Invitation unavailable")).toBeInTheDocument();
  });
  expect(screen.getByText("Boom")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Go home" }));
  expect(navigateMock).toHaveBeenCalledWith("/");
});

test("renders error card with default message when error has no message", async () => {
  authClientMock.organization.getInvitation.mockRejectedValueOnce({
    name: "BareError",
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <Provider store={createStore()}>
        <AcceptInvitationCard invitationId="inv_1" />
      </Provider>
    </QueryClientProvider>,
  );

  await waitFor(() => {
    expect(
      screen.getByText("This invitation may have expired or been revoked."),
    ).toBeInTheDocument();
  });
});

test("accepts invitation, shows pending spinner, and navigates home on success", async () => {
  let resolveAccept: (value: unknown) => void = () => {};
  authClientMock.organization.acceptInvitation.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveAccept = resolve;
    }),
  );
  renderWith("inv_1", {
    data: { organizationName: "Acme Inc" },
  });

  expect(screen.getByText("Acme Inc")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Accept/ }));

  await waitFor(() => {
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  resolveAccept({ data: {} });

  await waitFor(() => {
    expect(toastSuccessMock).toHaveBeenCalledWith("Invitation accepted");
  });
  expect(authClientMock.organization.acceptInvitation).toHaveBeenCalledWith({
    invitationId: "inv_1",
    fetchOptions: { throw: true },
  });
  expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["organizations"],
  });
  expect(navigateMock).toHaveBeenCalledWith("/", { wait: true });
});

test("toasts error when acceptInvitation fails", async () => {
  authClientMock.organization.acceptInvitation.mockRejectedValueOnce(
    new Error("nope"),
  );
  renderWith("inv_1", {
    data: { organizationName: "Acme" },
  });

  fireEvent.click(screen.getByRole("button", { name: /Accept/ }));

  await waitFor(() => {
    expect(toastErrorMock).toHaveBeenCalledWith(expect.any(Error));
  });
});

test("rejects invitation, shows pending spinner, and navigates home on success", async () => {
  let resolveReject: (value: unknown) => void = () => {};
  authClientMock.organization.rejectInvitation.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveReject = resolve;
    }),
  );
  renderWith("inv_2", {
    data: { organizationName: "Beta House" },
  });

  fireEvent.click(screen.getByRole("button", { name: /Decline/ }));

  await waitFor(() => {
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  resolveReject({ data: {} });

  await waitFor(() => {
    expect(toastSuccessMock).toHaveBeenCalledWith("Invitation declined");
  });
  expect(authClientMock.organization.rejectInvitation).toHaveBeenCalledWith({
    invitationId: "inv_2",
    fetchOptions: { throw: true },
  });
  expect(navigateMock).toHaveBeenCalledWith("/", { wait: true });
});

test("toasts error when rejectInvitation fails", async () => {
  authClientMock.organization.rejectInvitation.mockRejectedValueOnce(
    new Error("nope"),
  );
  renderWith("inv_2", {
    data: { organizationName: "Beta House" },
  });

  fireEvent.click(screen.getByRole("button", { name: /Decline/ }));

  await waitFor(() => {
    expect(toastErrorMock).toHaveBeenCalledWith(expect.any(Error));
  });
});
