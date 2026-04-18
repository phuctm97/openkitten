import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  createMockSession,
  mockSonnerToast,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

function mockManageAccountChrome() {
  vi.doMock("~/components/ui/dropdown-menu", () => ({
    DropdownMenu: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DropdownMenuContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DropdownMenuItem: ({
      children,
      onClick,
    }: {
      children: ReactNode;
      onClick?: () => void;
    }) => (
      <button onClick={onClick} type="button">
        {children}
      </button>
    ),
    DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
  }));
  vi.doMock("~/components/user/user-view", () => ({
    UserView: ({
      isPending,
      user,
    }: {
      isPending?: boolean;
      user?: { email?: string };
    }) => (
      <div
        data-testid="manage-user-view"
        data-email={user?.email ?? ""}
        data-pending={String(!!isPending)}
      />
    ),
  }));
}

beforeEach(() => {
  vi.resetModules();
});

test("shows a sign-out button for the active device session", async () => {
  const toast = mockSonnerToast();
  const current = createMockSession();
  const mocks = setupBetterAuthUiMocks({
    session: current,
  });
  mockManageAccountChrome();
  const { ManageAccount } = await import(
    "~/components/settings/account/manage-account"
  );

  render(<ManageAccount deviceSession={current} />);

  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(mocks.revokeMultiSession).toHaveBeenCalledWith({
    sessionToken: "session-token-1",
  });

  mocks.captured.revokeMultiSession?.onSuccess?.();
  expect(toast.toastSuccess).toHaveBeenCalledWith("Session revoked");
  mocks.captured.revokeMultiSession?.onError?.({
    error: { message: "Unable to revoke" },
  });
  expect(toast.toastError).toHaveBeenCalledWith("Unable to revoke");
});

test("shows switch and revoke actions for non-active sessions", async () => {
  const toast = mockSonnerToast();
  const current = createMockSession();
  const other = createMockSession({
    session: {
      id: "session-2",
      token: "session-token-2",
      userId: "user-2",
    },
    user: {
      email: "other@openkitten.dev",
      name: "Other Kitten",
    },
  });
  const mocks = setupBetterAuthUiMocks({
    session: current,
  });
  mockManageAccountChrome();
  const { ManageAccount } = await import(
    "~/components/settings/account/manage-account"
  );

  render(<ManageAccount deviceSession={other} isPending />);

  fireEvent.click(screen.getByRole("button", { name: "Switch account" }));
  expect(mocks.setActiveSession).toHaveBeenCalledWith({
    sessionToken: "session-token-2",
  });
  mocks.captured.setActiveSession?.onError?.({
    error: { message: "Unable to switch" },
  });
  expect(toast.toastError).toHaveBeenCalledWith("Unable to switch");

  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(mocks.revokeMultiSession).toHaveBeenCalledWith({
    sessionToken: "session-token-2",
  });
  expect(screen.getByTestId("manage-user-view")).toHaveAttribute(
    "data-pending",
    "true",
  );
});

test("shows the revoke spinner for the active account while sign-out is pending", async () => {
  const current = createMockSession();
  const mocks = setupBetterAuthUiMocks({
    pending: {
      revokeMultiSession: true,
    },
    session: current,
  });
  mockManageAccountChrome();
  const { ManageAccount } = await import(
    "~/components/settings/account/manage-account"
  );

  render(<ManageAccount deviceSession={current} />);

  expect(screen.getByRole("button", { name: /sign out/i })).toBeDisabled();
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  expect(mocks.revokeMultiSession).not.toHaveBeenCalled();
});
