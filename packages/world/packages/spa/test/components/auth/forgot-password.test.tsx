import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  mockSonnerToast,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

test("submits a reset request and manages field errors", async () => {
  mockSonnerToast();
  const mocks = setupBetterAuthUiMocks();
  const { ForgotPassword } = await import("~/components/auth/forgot-password");

  render(<ForgotPassword className="forgot-card" />);

  const emailInput = screen.getByLabelText("Email");

  Object.defineProperty(emailInput, "validationMessage", {
    configurable: true,
    value: "Email is required",
  });

  fireEvent.invalid(emailInput);

  expect(screen.getByRole("alert")).toHaveTextContent("Email is required");

  fireEvent.change(emailInput, { target: { value: "kitten@openkitten.dev" } });

  expect(screen.queryByRole("alert")).toBeNull();

  fireEvent.submit(screen.getByRole("button", { name: "Send reset link" }));

  expect(mocks.requestPasswordReset).toHaveBeenCalledWith({
    email: "kitten@openkitten.dev",
  });
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/auth/sign-in",
  );
  expect(
    screen.getByText("Forgot password").closest('[data-slot="card"]'),
  ).toHaveClass("forgot-card");
});

test("forwards success state to toast notifications", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks();
  const { ForgotPassword } = await import("~/components/auth/forgot-password");

  render(<ForgotPassword />);

  mocks.captured.requestPasswordReset?.onSuccess?.();

  expect(toast.toastSuccess).toHaveBeenCalledWith("Password reset email sent");
});

test("shows a spinner while a reset request is pending", async () => {
  mockSonnerToast();
  setupBetterAuthUiMocks({
    pending: {
      requestPasswordReset: true,
    },
  });
  const { ForgotPassword } = await import("~/components/auth/forgot-password");

  render(<ForgotPassword />);

  expect(
    screen.getByRole("button", { name: /Send reset link/u }),
  ).toBeDisabled();
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});
