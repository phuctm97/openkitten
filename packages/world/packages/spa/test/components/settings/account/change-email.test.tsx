import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  defaultSession,
  mockSonner,
  setupSettingsMocks,
} from "~/test/components/settings/mock-better-auth-ui-settings";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("submits a new email and renders the success toast on onSuccess", async () => {
  const sonner = mockSonner();
  const mocks = setupSettingsMocks();
  const { ChangeEmail } = await import(
    "~/components/settings/account/change-email"
  );

  render(<ChangeEmail className="email-card" />);

  const input = screen.getByLabelText("Email");
  expect(input).toHaveValue(defaultSession.user.email);

  fireEvent.change(input, { target: { value: "new@openkitten.dev" } });
  fireEvent.submit(screen.getByRole("button", { name: "Update email" }));

  expect(mocks.changeEmail).toHaveBeenCalledWith({
    newEmail: "new@openkitten.dev",
    callbackURL: "https://world.openkitten.dev/account",
  });

  mocks.captured.changeEmail?.onSuccess?.();
  expect(sonner.toastSuccess).toHaveBeenCalledWith("Email changed");
});

test("captures the validation message when the email field is invalid and clears it on change", async () => {
  mockSonner();
  setupSettingsMocks();
  const { ChangeEmail } = await import(
    "~/components/settings/account/change-email"
  );

  render(<ChangeEmail />);

  const input = screen.getByLabelText("Email");
  Object.defineProperty(input, "validationMessage", {
    configurable: true,
    value: "Email is required",
  });

  fireEvent.invalid(input);
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByText("Email is required")).toBeInTheDocument();

  fireEvent.change(input, { target: { value: "ok@openkitten.dev" } });
  expect(input).toHaveAttribute("aria-invalid", "false");
});

test("renders a skeleton input while the session is loading", async () => {
  mockSonner();
  setupSettingsMocks({ session: null });
  const { ChangeEmail } = await import(
    "~/components/settings/account/change-email"
  );

  const { container } = render(<ChangeEmail />);

  expect(container.querySelector("[data-slot='skeleton']")).not.toBeNull();
  expect(screen.getByRole("button", { name: "Update email" })).toBeDisabled();
});

test("shows a spinner when the change-email request is pending", async () => {
  mockSonner();
  setupSettingsMocks({ pending: { changeEmail: true } });
  const { ChangeEmail } = await import(
    "~/components/settings/account/change-email"
  );

  render(<ChangeEmail />);

  expect(screen.getByRole("button", { name: /Update email/u })).toBeDisabled();
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});
