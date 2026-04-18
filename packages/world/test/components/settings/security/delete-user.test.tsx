import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  createMockAccount,
  mockSonnerToast,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

function mockAlertDialog() {
  vi.doMock("~/components/ui/alert-dialog", () => ({
    AlertDialog: ({
      children,
      onOpenChange,
    }: {
      children: ReactNode;
      onOpenChange?: (open: boolean) => void;
    }) => (
      <div>
        <button onClick={() => onOpenChange?.(false)} type="button">
          Close dialog
        </button>
        {children}
      </div>
    ),
    AlertDialogAction: ({ children, ...props }: ComponentProps<"button">) => (
      <button {...props} type="submit">
        {children}
      </button>
    ),
    AlertDialogCancel: ({ children, ...props }: ComponentProps<"button">) => (
      <button {...props} type="button">
        {children}
      </button>
    ),
    AlertDialogContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogDescription: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogFooter: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogHeader: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogMedia: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogTitle: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogTrigger: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
  }));
}

beforeEach(() => {
  vi.resetModules();
});

test("requires the current password before deleting credential accounts", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    accounts: [
      createMockAccount({
        accountId: "credential-account",
        id: "credential-account",
        providerId: "credential",
      }),
    ],
  });
  mockAlertDialog();
  const { DeleteUser } = await import(
    "~/components/settings/security/delete-user"
  );

  const { container } = render(<DeleteUser />);

  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "hunter2" },
  });
  fireEvent.submit(container.querySelector("form") ?? document.body);

  expect(mocks.deleteUser).toHaveBeenCalledWith(
    { password: "hunter2" },
    expect.objectContaining({
      onError: expect.any(Function),
      onSuccess: expect.any(Function),
    }),
  );

  const deleteOptions = mocks.deleteUser.mock.calls[0]?.[1];
  deleteOptions?.onSuccess?.();
  deleteOptions?.onError?.({ message: "Unable to delete" });

  expect(toast.toastSuccess).toHaveBeenCalledWith("Account deleted");
  expect(toast.toastError).toHaveBeenCalledWith("Unable to delete");
  expect(mocks.auth.navigate).toHaveBeenCalledWith({
    replace: true,
    to: "/auth/sign-in",
  });
});

test("sends a verification flow without needing a password", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    accounts: [createMockAccount({ providerId: "github" })],
    auth: {
      deleteUser: {
        enabled: true,
        sendDeleteAccountVerification: true,
      },
    },
  });
  mockAlertDialog();
  const { DeleteUser } = await import(
    "~/components/settings/security/delete-user"
  );

  const { container } = render(<DeleteUser />);

  expect(screen.queryByLabelText("Password")).toBeNull();

  fireEvent.submit(container.querySelector("form") ?? document.body);

  expect(mocks.deleteUser).toHaveBeenCalledWith(
    {},
    expect.objectContaining({
      onSuccess: expect.any(Function),
    }),
  );

  const deleteOptions = mocks.deleteUser.mock.calls[0]?.[1];
  deleteOptions?.onSuccess?.();

  expect(toast.toastSuccess).toHaveBeenCalledWith(
    "Check your email to confirm deletion",
  );
  expect(mocks.auth.navigate).not.toHaveBeenCalled();
});

test("resets the password field when the dialog closes", async () => {
  setupBetterAuthUiMocks({
    accounts: [
      createMockAccount({
        accountId: "credential-account",
        id: "credential-account",
        providerId: "credential",
      }),
    ],
  });
  mockAlertDialog();
  const { DeleteUser } = await import(
    "~/components/settings/security/delete-user"
  );

  render(<DeleteUser />);

  const passwordInput = screen.getByLabelText("Password");

  fireEvent.change(passwordInput, {
    target: { value: "hunter2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));

  expect(passwordInput).toHaveValue("");
});

test("shows the destructive action spinner while deletion is pending", async () => {
  setupBetterAuthUiMocks({
    accounts: [createMockAccount({ providerId: "github" })],
    pending: {
      deleteUser: true,
    },
  });
  mockAlertDialog();
  const { DeleteUser } = await import(
    "~/components/settings/security/delete-user"
  );

  render(<DeleteUser />);

  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});
