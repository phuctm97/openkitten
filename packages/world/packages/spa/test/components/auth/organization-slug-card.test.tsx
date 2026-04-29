import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

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

const { OrganizationSlugCard } = await import(
  "~/components/auth/organization-slug-card"
);

function renderCard(orgId: string, seed?: { slug: string } | null) {
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
      <OrganizationSlugCard organizationId={orgId} />
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

test("seeds slug from organization, submits update, shows pending spinner", async () => {
  let resolveUpdate: (value: unknown) => void = () => {};
  authClientMock.organization.update.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveUpdate = resolve;
    }),
  );
  renderCard("org_1", { slug: "acme" });

  const input = screen.getByLabelText("Slug") as HTMLInputElement;
  expect(input.value).toBe("acme");

  fireEvent.change(input, { target: { value: "  acme-corp  " } });
  fireEvent.submit(input.closest("form")!);

  await waitFor(() => {
    expect(authClientMock.organization.update).toHaveBeenCalledWith({
      organizationId: "org_1",
      data: { slug: "acme-corp" },
      fetchOptions: { throw: true },
    });
  });
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();

  resolveUpdate({ data: {} });

  await waitFor(() => {
    expect(toastSuccessMock).toHaveBeenCalledWith("House slug updated");
  });
  expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["organizations"],
  });
});

test("shows slug-required error when submitting empty slug", async () => {
  renderCard("org_1", { slug: "acme" });
  const input = screen.getByLabelText("Slug") as HTMLInputElement;

  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.submit(input.closest("form")!);

  expect(screen.getByText("Slug is required")).toBeInTheDocument();
  expect(authClientMock.organization.update).not.toHaveBeenCalled();
});

test("typing clears error after validation failure", async () => {
  renderCard("org_1", { slug: "acme" });
  const input = screen.getByLabelText("Slug") as HTMLInputElement;

  fireEvent.change(input, { target: { value: "" } });
  fireEvent.submit(input.closest("form")!);
  expect(screen.getByText("Slug is required")).toBeInTheDocument();

  fireEvent.change(input, { target: { value: "x" } });
  expect(screen.queryByText("Slug is required")).toBeNull();
});

test("toasts error when update fails", async () => {
  authClientMock.organization.update.mockRejectedValueOnce(new Error("nope"));
  renderCard("org_1", { slug: "acme" });

  fireEvent.submit(screen.getByLabelText("Slug").closest("form")!);

  await waitFor(() => {
    expect(toastErrorMock).toHaveBeenCalledWith(expect.any(Error));
  });
});

test("does not seed slug when organization has no slug", async () => {
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
  client.setQueryData(["organizations", "full", "org_1"], { slug: "" });
  render(
    <QueryClientProvider client={client}>
      <OrganizationSlugCard organizationId="org_1" />
    </QueryClientProvider>,
  );

  const input = screen.getByLabelText("Slug") as HTMLInputElement;
  expect(input.value).toBe("");
});
