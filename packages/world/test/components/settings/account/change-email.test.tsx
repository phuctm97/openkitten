import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  mockSonnerToast,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

test("renders a skeleton when session data is unavailable", async () => {
  setupBetterAuthUiMocks({
    session: null,
  });
  const { ChangeEmail } = await import(
    "~/components/settings/account/change-email"
  );

  render(<ChangeEmail />);

  expect(document.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  expect(screen.getByRole("button", { name: "Update email" })).toBeDisabled();
});

test("submits a new email address and forwards success and error toasts", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks();
  const { ChangeEmail } = await import(
    "~/components/settings/account/change-email"
  );

  render(<ChangeEmail />);

  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "new@openkitten.dev" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Update email" }));

  expect(mocks.changeEmail).toHaveBeenCalledWith({
    callbackURL: "https://world.openkitten.dev/account",
    newEmail: "new@openkitten.dev",
  });

  mocks.captured.changeEmail?.onSuccess?.();
  mocks.captured.changeEmail?.onError?.({ message: "Unable to update" });

  expect(toast.toastSuccess).toHaveBeenCalledWith(
    "Verification email sent to the new address",
  );
  expect(toast.toastError).toHaveBeenCalledWith("Unable to update");
});

test("marks the field invalid when browser validation fails", async () => {
  setupBetterAuthUiMocks();
  const { ChangeEmail } = await import(
    "~/components/settings/account/change-email"
  );

  render(<ChangeEmail />);

  const input = screen.getByLabelText("Email");

  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Expected an email input");
  }

  input.setCustomValidity("Invalid email");
  fireEvent.invalid(input);

  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByText("Invalid email")).toBeInTheDocument();
});

test("shows a spinner while the email change is pending", async () => {
  setupBetterAuthUiMocks({
    pending: {
      changeEmail: true,
    },
  });
  const { ChangeEmail } = await import(
    "~/components/settings/account/change-email"
  );

  render(<ChangeEmail />);

  expect(screen.getByRole("button", { name: /update email/i })).toBeDisabled();
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});
