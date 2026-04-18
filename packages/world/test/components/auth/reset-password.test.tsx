import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  mockSonnerToast,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
  window.history.pushState({}, "", "/reset-password");
});

test("redirects away when the reset token is missing", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks();
  const { ResetPassword } = await import("~/components/auth/reset-password");

  render(<ResetPassword />);

  const passwordInput = screen.getByLabelText("Password");

  fireEvent.change(passwordInput, { target: { value: "hunter2password" } });
  fireEvent.submit(screen.getByRole("button", { name: "Reset password" }));

  expect(toast.toastError).toHaveBeenCalledWith(
    "Reset password token is invalid",
  );
  expect(mocks.auth.navigate).toHaveBeenCalledWith({ to: "/auth/sign-in" });
  expect(mocks.resetPassword).not.toHaveBeenCalled();
});

test("toggles password visibility and blocks mismatched passwords", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks();
  const { ResetPassword } = await import("~/components/auth/reset-password");

  window.history.pushState({}, "", "/reset-password?token=reset-123");

  render(<ResetPassword className="reset-card" />);

  const passwordInput = screen.getByLabelText("Password");
  const confirmPasswordInput = screen.getByLabelText("Confirm password");

  Object.defineProperty(passwordInput, "validationMessage", {
    configurable: true,
    value: "Password is required",
  });
  Object.defineProperty(confirmPasswordInput, "validationMessage", {
    configurable: true,
    value: "Please confirm the password",
  });

  fireEvent.invalid(passwordInput);
  fireEvent.invalid(confirmPasswordInput);

  expect(screen.getAllByRole("alert")).toHaveLength(2);

  fireEvent.change(passwordInput, { target: { value: "secret-pass" } });
  fireEvent.change(confirmPasswordInput, { target: { value: "another-pass" } });

  expect(screen.queryByRole("alert")).toBeNull();

  const [passwordToggle, confirmPasswordToggle] = screen.getAllByRole(
    "button",
    {
      name: "Show password",
    },
  );

  expect(passwordToggle).toBeDefined();
  expect(confirmPasswordToggle).toBeDefined();

  if (passwordToggle && confirmPasswordToggle) {
    fireEvent.click(passwordToggle);
    fireEvent.click(confirmPasswordToggle);
  }

  expect(passwordInput).toHaveAttribute("type", "text");
  expect(confirmPasswordInput).toHaveAttribute("type", "text");

  fireEvent.submit(screen.getByRole("button", { name: "Reset password" }));

  expect(toast.toastError).toHaveBeenCalledWith("Passwords do not match");
  expect(mocks.resetPassword).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/auth/sign-in",
  );
});

test("submits a valid reset and handles success and error callbacks", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    auth: {
      emailAndPassword: {
        confirmPassword: false,
        enabled: true,
        forgotPassword: true,
        maxPasswordLength: 64,
        minPasswordLength: 8,
        rememberMe: true,
        requireEmailVerification: false,
      },
    },
  });
  const { ResetPassword } = await import("~/components/auth/reset-password");

  window.history.pushState({}, "", "/reset-password?token=reset-123");

  render(<ResetPassword />);

  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "reset-pass-123" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Reset password" }));

  expect(mocks.resetPassword).toHaveBeenCalledWith({
    newPassword: "reset-pass-123",
    token: "reset-123",
  });
  expect(screen.queryByLabelText("Confirm password")).toBeNull();

  mocks.captured.resetPassword?.onError?.({
    error: { message: "Reset failed" },
  });
  mocks.captured.resetPassword?.onSuccess?.();

  expect(toast.toastError).toHaveBeenCalledWith("Reset failed");
  expect(toast.toastSuccess).toHaveBeenCalledWith(
    "Password reset successfully",
  );
  expect(mocks.auth.navigate).toHaveBeenCalledWith({ to: "/auth/sign-in" });
});

test("shows a spinner while a reset is pending and supports error fallbacks", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    pending: {
      resetPassword: true,
    },
  });
  const { ResetPassword } = await import("~/components/auth/reset-password");

  window.history.pushState({}, "", "/reset-password?token=reset-123");

  render(<ResetPassword />);

  mocks.captured.resetPassword?.onError?.({ message: "Reset pending failed" });

  expect(
    screen.getByRole("button", { name: /Reset password/u }),
  ).toBeDisabled();
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  expect(toast.toastError).toHaveBeenCalledWith("Reset pending failed");
});
