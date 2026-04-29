import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  defaultAccount,
  mockSonner,
  setupSettingsMocks,
} from "~/test/components/settings/mock-better-auth-ui-settings";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("renders the change-password form when the user has a credential account", async () => {
  const sonner = mockSonner();
  const mocks = setupSettingsMocks({
    accounts: [
      { ...defaultAccount, id: "a1", accountId: "k", providerId: "credential" },
    ],
  });
  const { ChangePassword } = await import(
    "~/components/settings/security/change-password"
  );

  render(<ChangePassword className="pwd" />);

  fireEvent.change(screen.getByLabelText("Current password"), {
    target: { value: "current-password" },
  });
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "new-password!" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "new-password!" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Update password" }));

  expect(mocks.changePassword).toHaveBeenCalledWith({
    currentPassword: "current-password",
    newPassword: "new-password!",
    revokeOtherSessions: true,
  });

  await act(async () => {
    mocks.captured.changePassword?.onSuccess?.();
  });
  expect(sonner.toastSuccess).toHaveBeenCalledWith("Password changed");
  expect(screen.getByLabelText("Current password")).toHaveValue("");
});

test("shows toast error and clears all fields on changePassword failure", async () => {
  const sonner = mockSonner();
  const mocks = setupSettingsMocks({
    accounts: [
      { ...defaultAccount, id: "a1", accountId: "k", providerId: "credential" },
    ],
  });
  const { ChangePassword } = await import(
    "~/components/settings/security/change-password"
  );

  render(<ChangePassword />);

  fireEvent.change(screen.getByLabelText("Current password"), {
    target: { value: "wrong" },
  });
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "new-password!" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "new-password!" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Update password" }));

  mocks.captured.changePassword?.onError?.({
    error: { message: "Wrong password" },
  });
  expect(sonner.toastError).toHaveBeenCalledWith("Wrong password");

  mocks.captured.changePassword?.onError?.({ message: "Top error" });
  expect(sonner.toastError).toHaveBeenCalledWith("Top error");
});

test("shows toast error when passwords do not match without calling changePassword", async () => {
  const sonner = mockSonner();
  const mocks = setupSettingsMocks({
    accounts: [
      { ...defaultAccount, id: "a1", accountId: "k", providerId: "credential" },
    ],
  });
  const { ChangePassword } = await import(
    "~/components/settings/security/change-password"
  );

  render(<ChangePassword />);

  fireEvent.change(screen.getByLabelText("Current password"), {
    target: { value: "current" },
  });
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "new1!" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "new2!" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Update password" }));

  expect(sonner.toastError).toHaveBeenCalledWith("Passwords do not match");
  expect(mocks.changePassword).not.toHaveBeenCalled();
});

test("renders set-password CTA and dispatches a reset email when the user has only social accounts", async () => {
  const sonner = mockSonner();
  const mocks = setupSettingsMocks({
    accounts: [
      { ...defaultAccount, id: "a2", accountId: "g", providerId: "github" },
    ],
  });
  const { ChangePassword } = await import(
    "~/components/settings/security/change-password"
  );

  render(<ChangePassword className="set" />);

  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  expect(mocks.requestPasswordReset).toHaveBeenCalledWith({
    email: "user-1@openkitten.dev",
  });

  mocks.captured.requestPasswordReset?.onSuccess?.();
  expect(sonner.toastSuccess).toHaveBeenCalledWith("Password reset email sent");
});

test("set-password CTA does nothing when the session is not yet loaded", async () => {
  mockSonner();
  const mocks = setupSettingsMocks({
    accounts: [
      { ...defaultAccount, id: "a2", accountId: "g", providerId: "github" },
    ],
    pending: { listAccounts: false },
    session: null,
  });
  const { ChangePassword } = await import(
    "~/components/settings/security/change-password"
  );

  render(<ChangePassword />);

  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
});

test("renders skeletons when accounts are loading", async () => {
  mockSonner();
  setupSettingsMocks({ pending: { listAccounts: true } });
  const { ChangePassword } = await import(
    "~/components/settings/security/change-password"
  );

  const { container } = render(<ChangePassword />);

  expect(
    container.querySelectorAll("[data-slot='skeleton']").length,
  ).toBeGreaterThan(0);
});

test("toggles new and confirm password visibility", async () => {
  mockSonner();
  setupSettingsMocks({
    accounts: [
      { ...defaultAccount, id: "a1", accountId: "k", providerId: "credential" },
    ],
  });
  const { ChangePassword } = await import(
    "~/components/settings/security/change-password"
  );

  render(<ChangePassword />);

  const newPwdInput = screen.getByLabelText("New password");
  const confirmPwdInput = screen.getByLabelText("Confirm password");
  expect(newPwdInput).toHaveAttribute("type", "password");
  expect(confirmPwdInput).toHaveAttribute("type", "password");

  const showButtons = screen.getAllByRole("button", { name: "Show password" });
  fireEvent.click(showButtons[0] as HTMLButtonElement);
  expect(newPwdInput).toHaveAttribute("type", "text");
  expect(confirmPwdInput).toHaveAttribute("type", "password");

  fireEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(confirmPwdInput).toHaveAttribute("type", "text");

  const hideButtons = screen.getAllByRole("button", { name: "Hide password" });
  fireEvent.click(hideButtons[0] as HTMLButtonElement);
  fireEvent.click(hideButtons[1] as HTMLButtonElement);
  expect(newPwdInput).toHaveAttribute("type", "password");
  expect(confirmPwdInput).toHaveAttribute("type", "password");
});

test("captures invalid validation messages and clears them on change", async () => {
  mockSonner();
  setupSettingsMocks({
    accounts: [
      { ...defaultAccount, id: "a1", accountId: "k", providerId: "credential" },
    ],
  });
  const { ChangePassword } = await import(
    "~/components/settings/security/change-password"
  );

  render(<ChangePassword />);

  for (const label of [
    "Current password",
    "New password",
    "Confirm password",
  ]) {
    const input = screen.getByLabelText(label);
    Object.defineProperty(input, "validationMessage", {
      configurable: true,
      value: `${label} is required`,
    });
    fireEvent.invalid(input);
    expect(input).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(input, { target: { value: "abc" } });
    expect(input).toHaveAttribute("aria-invalid", "false");
  }
});

test("hides confirm-password field when the option is disabled", async () => {
  mockSonner();
  setupSettingsMocks({
    accounts: [
      { ...defaultAccount, id: "a1", accountId: "k", providerId: "credential" },
    ],
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
  const { ChangePassword } = await import(
    "~/components/settings/security/change-password"
  );

  render(<ChangePassword />);

  expect(screen.queryByLabelText("Confirm password")).toBeNull();

  fireEvent.change(screen.getByLabelText("Current password"), {
    target: { value: "cur" },
  });
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "new" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Update password" }));
});

test("renders skeleton inputs when accounts are loaded but session is still loading", async () => {
  mockSonner();
  setupSettingsMocks({
    accounts: [
      { ...defaultAccount, id: "a1", accountId: "k", providerId: "credential" },
    ],
    pending: { listAccounts: false },
    session: null,
  });
  const { ChangePassword } = await import(
    "~/components/settings/security/change-password"
  );

  const { container } = render(<ChangePassword />);

  expect(
    container.querySelectorAll("[data-slot='skeleton']").length,
  ).toBeGreaterThanOrEqual(3);
});

test("renders a spinner inside the change-password submit while changePassword is pending", async () => {
  mockSonner();
  setupSettingsMocks({
    accounts: [
      { ...defaultAccount, id: "a1", accountId: "k", providerId: "credential" },
    ],
    pending: { changePassword: true },
  });
  const { ChangePassword } = await import(
    "~/components/settings/security/change-password"
  );

  render(<ChangePassword />);

  const updateButton = screen.getByRole("button", { name: /update password/i });
  expect(updateButton.querySelector('[role="status"]')).toBeInTheDocument();
});

test("renders a spinner inside the set-password CTA while requestPasswordReset is pending", async () => {
  mockSonner();
  setupSettingsMocks({
    accounts: [
      { ...defaultAccount, id: "a2", accountId: "g", providerId: "github" },
    ],
    pending: { requestPasswordReset: true },
  });
  const { ChangePassword } = await import(
    "~/components/settings/security/change-password"
  );

  render(<ChangePassword />);

  const sendButton = screen.getByRole("button", { name: /send reset link/i });
  expect(sendButton.querySelector('[role="status"]')).toBeInTheDocument();
});
