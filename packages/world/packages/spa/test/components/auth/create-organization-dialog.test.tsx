import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const authClientMock = vi.hoisted(() => ({
  organization: { create: vi.fn() },
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

const { CreateOrganizationDialog } = await import(
  "~/components/auth/create-organization-dialog"
);

function renderDialog(onOpenChange = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    onOpenChange,
    ...render(
      <QueryClientProvider client={client}>
        <CreateOrganizationDialog open={true} onOpenChange={onOpenChange} />
      </QueryClientProvider>,
    ),
  };
}

beforeEach(() => {
  authClientMock.organization.create.mockReset();
  queryClientMock.invalidateQueries.mockReset();
  queryClientMock.invalidateQueries.mockResolvedValue(undefined);
  toastErrorMock.mockReset();
  toastSuccessMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

test("auto-generates slug from name and submits valid input on success", async () => {
  let resolveCreate: (value: unknown) => void = () => {};
  authClientMock.organization.create.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveCreate = resolve;
    }),
  );
  const { onOpenChange } = renderDialog();

  const nameInput = screen.getByLabelText("Name");
  const slugInput = screen.getByLabelText("Slug");

  fireEvent.change(nameInput, { target: { value: "  Acme Co!  " } });
  expect((slugInput as HTMLInputElement).value).toBe("acme-co");

  fireEvent.submit(nameInput.closest("form")!);

  await waitFor(() => {
    expect(authClientMock.organization.create).toHaveBeenCalledWith({
      name: "Acme Co!",
      slug: "acme-co",
      fetchOptions: { throw: true },
    });
  });
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();

  resolveCreate({ data: {} });

  await waitFor(() => {
    expect(toastSuccessMock).toHaveBeenCalledWith("House created");
  });
  expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["organizations"],
  });
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("shows validation errors for empty name and slug", async () => {
  renderDialog();

  const form = screen.getByLabelText("Name").closest("form")!;
  fireEvent.submit(form);

  expect(screen.getByText("Name is required")).toBeInTheDocument();
  expect(screen.getByText("Slug is required")).toBeInTheDocument();
  expect(authClientMock.organization.create).not.toHaveBeenCalled();
});

test("clears validation error when user types in name and slug", async () => {
  renderDialog();
  const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
  const slugInput = screen.getByLabelText("Slug") as HTMLInputElement;
  const form = nameInput.closest("form")!;

  fireEvent.submit(form);
  expect(screen.getByText("Name is required")).toBeInTheDocument();
  expect(screen.getByText("Slug is required")).toBeInTheDocument();

  fireEvent.change(nameInput, { target: { value: "X" } });
  expect(screen.queryByText("Name is required")).toBeNull();

  fireEvent.change(slugInput, { target: { value: "" } });
  fireEvent.submit(form);
  expect(screen.getByText("Slug is required")).toBeInTheDocument();

  fireEvent.change(slugInput, { target: { value: "x" } });
  expect(screen.queryByText("Slug is required")).toBeNull();
});

test("decoupled slug stays manual after the user edits it", async () => {
  authClientMock.organization.create.mockResolvedValueOnce({ data: {} });
  renderDialog();
  const nameInput = screen.getByLabelText("Name");
  const slugInput = screen.getByLabelText("Slug");

  fireEvent.change(slugInput, { target: { value: "custom" } });
  fireEvent.change(nameInput, { target: { value: "Different Name" } });
  expect((slugInput as HTMLInputElement).value).toBe("custom");
});

test("cancel button calls onOpenChange(false)", async () => {
  const { onOpenChange } = renderDialog();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("dialog onOpenChange forwards open=true and resets state on close", async () => {
  const { onOpenChange } = renderDialog();

  fireEvent.click(screen.getByTestId("dialog-open-true"));
  expect(onOpenChange).toHaveBeenCalledWith(true);

  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Acme" },
  });
  fireEvent.click(screen.getByTestId("dialog-open-false"));
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("toasts error when creation fails", async () => {
  authClientMock.organization.create.mockRejectedValueOnce(new Error("nope"));
  renderDialog();

  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Acme" },
  });
  fireEvent.change(screen.getByLabelText("Slug"), {
    target: { value: "acme" },
  });
  fireEvent.submit(screen.getByLabelText("Name").closest("form")!);

  await waitFor(() => {
    expect(toastErrorMock).toHaveBeenCalledWith(expect.any(Error));
  });
});

test("slugify trims, lowercases, and slices to 48 chars", async () => {
  authClientMock.organization.create.mockResolvedValueOnce({ data: {} });
  renderDialog();

  const long = "A".repeat(60) + " trailing!!!";
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: long } });
  const slugInput = screen.getByLabelText("Slug") as HTMLInputElement;

  expect(slugInput.value.length).toBeLessThanOrEqual(48);
  expect(slugInput.value).not.toMatch(/[A-Z]/);
});
