import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  createMockAccount,
  mockSonnerToast,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

test("falls back to the set-password flow when no credential account exists", async () => {
  const mocks = setupBetterAuthUiMocks({
    accounts: [createMockAccount({ providerId: "github" })],
  });
  const { ChangePassword } = await import(
    "~/components/settings/security/change-password"
  );

  render(<ChangePassword />);

  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

  expect(mocks.requestPasswordReset).toHaveBeenCalledWith({
    email: "kitten@openkitten.dev",
  });
});

test("disables the reset action when no session is available", async () => {
  const mocks = setupBetterAuthUiMocks({
    accounts: [createMockAccount({ providerId: "github" })],
    session: null,
  });
  const { ChangePassword } = await import(
    "~/components/settings/security/change-password"
  );

  render(<ChangePassword />);

  const button = screen.getByRole("button", { name: "Send reset link" });

  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
});

test("forwards reset-link success and error callbacks to toast", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    accounts: [createMockAccount({ providerId: "github" })],
  });
  const { ChangePassword } = await import(
    "~/components/settings/security/change-password"
  );

  render(<ChangePassword />);

  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

  mocks.captured.requestPasswordReset?.onSuccess?.();
  mocks.captured.requestPasswordReset?.onError?.({
    error: { message: "Unable to send reset link" },
  });

  expect(toast.toastSuccess).toHaveBeenCalledWith("Password reset email sent");
  expect(toast.toastError).toHaveBeenCalledWith("Unable to send reset link");
});

test("shows the reset-link spinner while the request is pending", async () => {
  setupBetterAuthUiMocks({
    accounts: [createMockAccount({ providerId: "github" })],
    pending: {
      requestPasswordReset: true,
    },
  });
  const { ChangePassword } = await import(
    "~/components/settings/security/change-password"
  );

  render(<ChangePassword />);

  expect(
    screen.getByRole("button", { name: /send reset link/i }),
  ).toBeDisabled();
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});

test("shows a validation toast when confirmation does not match", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks();
  const { ChangePassword } = await import(
    "~/components/settings/security/change-password"
  );

  render(<ChangePassword />);

  fireEvent.change(screen.getByLabelText("Current password"), {
    target: { value: "old-password" },
  });
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "new-password" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "different-password" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Update password" }));

  expect(toast.toastError).toHaveBeenCalledWith("Passwords do not match");
  expect(mocks.changePassword).not.toHaveBeenCalled();
});

test("submits password changes and toggles password visibility", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks();
  const { ChangePassword } = await import(
    "~/components/settings/security/change-password"
  );

  render(<ChangePassword />);

  const newPasswordInput = screen.getByLabelText("New password");
  const confirmPasswordInput = screen.getByLabelText("Confirm password");
  const toggleButtons = screen.getAllByRole("button", {
    name: /show password/i,
  });

  expect(toggleButtons).toHaveLength(2);

  fireEvent.click(toggleButtons[0] ?? document.body);
  fireEvent.click(toggleButtons[1] ?? document.body);

  expect(newPasswordInput).toHaveAttribute("type", "text");
  expect(confirmPasswordInput).toHaveAttribute("type", "text");

  fireEvent.change(screen.getByLabelText("Current password"), {
    target: { value: "old-password" },
  });
  fireEvent.change(newPasswordInput, {
    target: { value: "new-password" },
  });
  fireEvent.change(confirmPasswordInput, {
    target: { value: "new-password" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Update password" }));

  expect(mocks.changePassword).toHaveBeenCalledWith({
    currentPassword: "old-password",
    newPassword: "new-password",
    revokeOtherSessions: true,
  });

  mocks.captured.changePassword?.onError?.({ message: "Unable to update" });
  mocks.captured.changePassword?.onSuccess?.();

  expect(toast.toastError).toHaveBeenCalledWith("Unable to update");
  expect(toast.toastSuccess).toHaveBeenCalledWith(
    "Password changed successfully",
  );
});

test("renders loading skeletons while accounts are still loading", async () => {
  setupBetterAuthUiMocks({
    pending: {
      listAccounts: true,
    },
  });
  const { ChangePassword } = await import(
    "~/components/settings/security/change-password"
  );

  render(<ChangePassword />);

  expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBe(3);
  expect(
    screen.getByRole("button", { name: "Update password" }),
  ).toBeDisabled();
});

test("marks each password field invalid and forwards change errors", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks();
  const { ChangePassword } = await import(
    "~/components/settings/security/change-password"
  );

  render(<ChangePassword />);

  const currentPassword = screen.getByLabelText("Current password");
  const newPassword = screen.getByLabelText("New password");
  const confirmPassword = screen.getByLabelText("Confirm password");

  if (!(currentPassword instanceof HTMLInputElement)) {
    throw new Error("Expected a current password input");
  }
  if (!(newPassword instanceof HTMLInputElement)) {
    throw new Error("Expected a new password input");
  }
  if (!(confirmPassword instanceof HTMLInputElement)) {
    throw new Error("Expected a confirm password input");
  }

  currentPassword.setCustomValidity("Current password is required");
  fireEvent.invalid(currentPassword);
  newPassword.setCustomValidity("New password is required");
  fireEvent.invalid(newPassword);
  confirmPassword.setCustomValidity("Confirm password is required");
  fireEvent.invalid(confirmPassword);

  expect(currentPassword).toHaveAttribute("aria-invalid", "true");
  expect(newPassword).toHaveAttribute("aria-invalid", "true");
  expect(confirmPassword).toHaveAttribute("aria-invalid", "true");

  mocks.captured.changePassword?.onError?.({
    error: { message: "Unable to update password" },
  });

  expect(toast.toastError).toHaveBeenCalledWith("Unable to update password");
});

test("shows the update spinner while a password change is pending", async () => {
  setupBetterAuthUiMocks({
    pending: {
      changePassword: true,
    },
  });
  const { ChangePassword } = await import(
    "~/components/settings/security/change-password"
  );

  render(<ChangePassword />);

  expect(
    screen.getByRole("button", { name: /update password/i }),
  ).toBeDisabled();
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});
