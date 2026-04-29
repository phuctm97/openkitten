import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { closestForm } from "~/test/lib/closest-form";

const authClientMock = vi.hoisted(() => ({
  organization: {
    update: vi.fn(),
    getFullOrganization: vi.fn(),
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

const { OrganizationNameCard } = await import(
  "~/components/auth/organization-name-card"
);

function renderCard(orgId: string, seed?: { name: string } | null) {
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
  if (seed) {
    client.setQueryData(["organizations", "full", orgId], seed);
  }
  authClientMock.organization.getFullOrganization.mockResolvedValue(seed);
  return render(
    <QueryClientProvider client={client}>
      <OrganizationNameCard organizationId={orgId} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  authClientMock.organization.update.mockReset();
  authClientMock.organization.getFullOrganization.mockReset();
  queryClientMock.invalidateQueries.mockReset();
  queryClientMock.invalidateQueries.mockResolvedValue(undefined);
  toastErrorMock.mockReset();
  toastSuccessMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

test("disables save when no organization is loaded", async () => {
  renderCard("org_1");

  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
});

test("seeds name from organization, submits update, shows pending spinner", async () => {
  let resolveUpdate: (value: unknown) => void = () => {};
  authClientMock.organization.update.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveUpdate = resolve;
    }),
  );
  renderCard("org_1", { name: "Acme" });

  const input = screen.getByLabelText("Name") as HTMLInputElement;
  expect(input.value).toBe("Acme");

  fireEvent.change(input, { target: { value: "  Acme Corp  " } });
  fireEvent.submit(closestForm(input));

  await waitFor(() => {
    expect(authClientMock.organization.update).toHaveBeenCalledWith({
      organizationId: "org_1",
      data: { name: "Acme Corp" },
      fetchOptions: { throw: true },
    });
  });
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();

  resolveUpdate({ data: {} });

  await waitFor(() => {
    expect(toastSuccessMock).toHaveBeenCalledWith("House name updated");
  });
  expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["organizations"],
  });
});

test("shows name-required error when submitting empty name", async () => {
  renderCard("org_1", { name: "Acme" });
  const input = screen.getByLabelText("Name") as HTMLInputElement;

  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.submit(closestForm(input));

  expect(screen.getByText("Name is required")).toBeInTheDocument();
  expect(authClientMock.organization.update).not.toHaveBeenCalled();
});

test("typing clears error after validation failure", async () => {
  renderCard("org_1", { name: "Acme" });
  const input = screen.getByLabelText("Name") as HTMLInputElement;

  fireEvent.change(input, { target: { value: "" } });
  fireEvent.submit(closestForm(input));
  expect(screen.getByText("Name is required")).toBeInTheDocument();

  fireEvent.change(input, { target: { value: "X" } });
  expect(screen.queryByText("Name is required")).toBeNull();
});

test("toasts error when update fails", async () => {
  authClientMock.organization.update.mockRejectedValueOnce(new Error("nope"));
  renderCard("org_1", { name: "Acme" });

  fireEvent.submit(closestForm(screen.getByLabelText("Name")));

  await waitFor(() => {
    expect(toastErrorMock).toHaveBeenCalledWith(expect.any(Error));
  });
});

test("does not seed name when organization has no name", async () => {
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
  client.setQueryData(["organizations", "full", "org_1"], { name: "" });
  render(
    <QueryClientProvider client={client}>
      <OrganizationNameCard organizationId="org_1" />
    </QueryClientProvider>,
  );

  const input = screen.getByLabelText("Name") as HTMLInputElement;
  expect(input.value).toBe("");
});
