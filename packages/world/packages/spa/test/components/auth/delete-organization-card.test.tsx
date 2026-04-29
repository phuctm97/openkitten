import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { closestForm } from "~/test/lib/closest-form";

function firstOrFail<T>(items: T[]): T {
  const [head] = items;
  if (head === undefined) throw new Error("Expected at least one item");
  return head;
}

const authClientMock = vi.hoisted(() => ({
  organization: {
    delete: vi.fn(),
    getFullOrganization: vi.fn(),
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

vi.mock("~/components/ui/dialog", async () => {
  return {
    Dialog: ({
      open,
      onOpenChange,
      children,
    }: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      children: ReactNode;
    }) =>
      open ? (
        <div data-testid="dialog">
          <button
            type="button"
            data-testid="dialog-open-true"
            onClick={() => onOpenChange(true)}
          />
          <button
            type="button"
            data-testid="dialog-open-false"
            onClick={() => onOpenChange(false)}
          />
          {children}
        </div>
      ) : null,
    DialogContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DialogDescription: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DialogFooter: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DialogHeader: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DialogTitle: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

const { DeleteOrganizationCard } = await import(
  "~/components/auth/delete-organization-card"
);

function renderCard(
  orgId: string,
  seed?: { slug: string; name: string } | null,
) {
  authClientMock.organization.getFullOrganization.mockResolvedValue(
    seed ?? null,
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
  if (seed) {
    client.setQueryData(["organizations", "full", orgId], seed);
  }
  return render(
    <QueryClientProvider client={client}>
      <Provider store={createStore()}>
        <DeleteOrganizationCard organizationId={orgId} />
      </Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  authClientMock.organization.delete.mockReset();
  authClientMock.organization.getFullOrganization.mockReset();
  navigateMock.mockReset();
  queryClientMock.invalidateQueries.mockReset();
  queryClientMock.invalidateQueries.mockResolvedValue(undefined);
  navigateMock.mockResolvedValue(undefined);
  toastErrorMock.mockReset();
  toastSuccessMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

test("disables delete button when organization is unavailable", async () => {
  renderCard("org_1");

  expect(screen.getByRole("button", { name: "Delete house" })).toBeDisabled();
});

test("opens confirm dialog and deletes after correct slug", async () => {
  let resolveDelete: (value: unknown) => void = () => {};
  authClientMock.organization.delete.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveDelete = resolve;
    }),
  );
  renderCard("org_1", { name: "Acme", slug: "acme" });

  fireEvent.click(
    firstOrFail(screen.getAllByRole("button", { name: "Delete house" })),
  );

  expect(screen.getAllByText("Delete house").length).toBeGreaterThan(0);
  const confirmInput = screen.getByLabelText("House slug") as HTMLInputElement;
  fireEvent.change(confirmInput, { target: { value: "acme" } });
  fireEvent.submit(closestForm(confirmInput));

  await waitFor(() => {
    expect(authClientMock.organization.delete).toHaveBeenCalledWith({
      organizationId: "org_1",
      fetchOptions: { throw: true },
    });
  });
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();

  resolveDelete({ data: {} });

  await waitFor(() => {
    expect(toastSuccessMock).toHaveBeenCalledWith("House deleted");
  });
  expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["organizations"],
  });
  expect(navigateMock).toHaveBeenCalledWith("/", { wait: true });
});

test("shows mismatch error when slug does not match", async () => {
  renderCard("org_1", { name: "Acme", slug: "acme" });
  fireEvent.click(
    firstOrFail(screen.getAllByRole("button", { name: "Delete house" })),
  );
  const confirmInput = screen.getByLabelText("House slug") as HTMLInputElement;
  fireEvent.change(confirmInput, { target: { value: "wrong" } });
  fireEvent.submit(closestForm(confirmInput));

  expect(screen.getByText("Slug does not match")).toBeInTheDocument();
  expect(authClientMock.organization.delete).not.toHaveBeenCalled();
});

test("clears slug error and clears confirm input when dialog closes", async () => {
  renderCard("org_1", { name: "Acme", slug: "acme" });
  fireEvent.click(
    firstOrFail(screen.getAllByRole("button", { name: "Delete house" })),
  );
  const confirmInput = screen.getByLabelText("House slug") as HTMLInputElement;

  fireEvent.change(confirmInput, { target: { value: "wrong" } });
  fireEvent.submit(closestForm(confirmInput));
  expect(screen.getByText("Slug does not match")).toBeInTheDocument();

  fireEvent.change(confirmInput, { target: { value: "another" } });
  expect(screen.queryByText("Slug does not match")).toBeNull();

  fireEvent.click(screen.getByTestId("dialog-open-false"));
  expect(screen.queryByTestId("dialog")).toBeNull();
});

test("Cancel button closes dialog directly", async () => {
  renderCard("org_1", { name: "Acme", slug: "acme" });
  fireEvent.click(
    firstOrFail(screen.getAllByRole("button", { name: "Delete house" })),
  );
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByTestId("dialog")).toBeNull();
});

test("dialog onOpenChange forwards open=true without state reset", async () => {
  renderCard("org_1", { name: "Acme", slug: "acme" });

  fireEvent.click(
    firstOrFail(screen.getAllByRole("button", { name: "Delete house" })),
  );

  fireEvent.change(screen.getByLabelText("House slug"), {
    target: { value: "wrong" },
  });
  fireEvent.submit(closestForm(screen.getByLabelText("House slug")));

  expect(screen.getByText("Slug does not match")).toBeInTheDocument();
  fireEvent.click(screen.getByTestId("dialog-open-true"));
  expect(screen.getByText("Slug does not match")).toBeInTheDocument();
});

test("toasts error when deletion fails", async () => {
  authClientMock.organization.delete.mockRejectedValueOnce(new Error("nope"));
  renderCard("org_1", { name: "Acme", slug: "acme" });
  fireEvent.click(
    firstOrFail(screen.getAllByRole("button", { name: "Delete house" })),
  );
  fireEvent.change(screen.getByLabelText("House slug"), {
    target: { value: "acme" },
  });
  fireEvent.submit(closestForm(screen.getByLabelText("House slug")));

  await waitFor(() => {
    expect(toastErrorMock).toHaveBeenCalledWith(expect.any(Error));
  });
});
