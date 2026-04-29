import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const authClientMock = vi.hoisted(() => ({
  organization: { inviteMember: vi.fn() },
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

vi.mock("~/components/ui/select", async () => {
  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value: string;
      onValueChange: (value: string) => void;
      disabled?: boolean;
      children: ReactNode;
    }) => (
      <div data-testid="select" data-value={value}>
        <button
          type="button"
          data-testid="select-set-admin"
          onClick={() => onValueChange("admin")}
        />
        <button
          type="button"
          data-testid="select-set-bogus"
          onClick={() => onValueChange("not-a-role")}
        />
        {children}
      </div>
    ),
    SelectContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    SelectItem: ({
      value,
      children,
    }: {
      value: string;
      children: ReactNode;
    }) => <div data-testid={`select-item-${value}`}>{children}</div>,
    SelectTrigger: ({ children, id }: { children: ReactNode; id: string }) => (
      <div id={id}>{children}</div>
    ),
    SelectValue: () => <span data-testid="select-value" />,
  };
});

const { InviteMemberDialog } = await import(
  "~/components/auth/invite-member-dialog"
);

function renderDialog(props?: { open?: boolean }) {
  const onOpenChange = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    onOpenChange,
    ...render(
      <QueryClientProvider client={client}>
        <InviteMemberDialog
          organizationId="org_1"
          open={props?.open ?? true}
          onOpenChange={onOpenChange}
        />
      </QueryClientProvider>,
    ),
  };
}

beforeEach(() => {
  authClientMock.organization.inviteMember.mockReset();
  queryClientMock.invalidateQueries.mockReset();
  queryClientMock.invalidateQueries.mockResolvedValue(undefined);
  toastErrorMock.mockReset();
  toastSuccessMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

test("submits invite, shows pending spinner, and resets on success", async () => {
  let resolveInvite: (value: unknown) => void = () => {};
  authClientMock.organization.inviteMember.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveInvite = resolve;
    }),
  );
  const { onOpenChange } = renderDialog();

  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: " teammate@openkitten.dev " },
  });
  fireEvent.click(screen.getByTestId("select-set-admin"));
  fireEvent.submit(screen.getByLabelText("Email").closest("form")!);

  await waitFor(() => {
    expect(authClientMock.organization.inviteMember).toHaveBeenCalledWith({
      email: "teammate@openkitten.dev",
      role: "admin",
      organizationId: "org_1",
      fetchOptions: { throw: true },
    });
  });
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();

  resolveInvite({ data: {} });

  await waitFor(() => {
    expect(toastSuccessMock).toHaveBeenCalledWith("Invitation sent");
  });
  expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["organizations", "invitations", "org_1"],
  });
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("shows email-required error and does not submit", async () => {
  renderDialog();

  fireEvent.submit(screen.getByLabelText("Email").closest("form")!);
  expect(screen.getByText("Email is required")).toBeInTheDocument();
  expect(authClientMock.organization.inviteMember).not.toHaveBeenCalled();
});

test("typing email clears the email error", async () => {
  renderDialog();
  fireEvent.submit(screen.getByLabelText("Email").closest("form")!);
  expect(screen.getByText("Email is required")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "x" },
  });
  expect(screen.queryByText("Email is required")).toBeNull();
});

test("Cancel button calls onOpenChange(false)", async () => {
  const { onOpenChange } = renderDialog();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("ignores invalid role values from select", async () => {
  authClientMock.organization.inviteMember.mockResolvedValueOnce({ data: {} });
  renderDialog();

  fireEvent.click(screen.getByTestId("select-set-bogus"));
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "user@example.com" },
  });
  fireEvent.submit(screen.getByLabelText("Email").closest("form")!);

  await waitFor(() => {
    expect(authClientMock.organization.inviteMember).toHaveBeenCalledWith({
      email: "user@example.com",
      role: "member",
      organizationId: "org_1",
      fetchOptions: { throw: true },
    });
  });
});

test("dialog onOpenChange handles both open=true and open=false", async () => {
  const { onOpenChange } = renderDialog();

  fireEvent.click(screen.getByTestId("dialog-open-true"));
  expect(onOpenChange).toHaveBeenCalledWith(true);

  fireEvent.click(screen.getByTestId("dialog-open-false"));
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("toasts error when invite fails", async () => {
  authClientMock.organization.inviteMember.mockRejectedValueOnce(
    new Error("nope"),
  );
  renderDialog();

  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "user@example.com" },
  });
  fireEvent.submit(screen.getByLabelText("Email").closest("form")!);

  await waitFor(() => {
    expect(toastErrorMock).toHaveBeenCalledWith(expect.any(Error));
  });
});
