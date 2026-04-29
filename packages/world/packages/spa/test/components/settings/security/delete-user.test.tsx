import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

test("submits with a password and navigates after deletion when verification is disabled", async () => {
  const sonner = mockSonner();
  const mocks = setupSettingsMocks({
    accounts: [
      { ...defaultAccount, id: "a1", accountId: "k", providerId: "credential" },
    ],
  });
  const { DeleteUser } = await import(
    "~/components/settings/security/delete-user"
  );

  render(<DeleteUser className="dz" />);

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Delete account" }));

  const passwordInput = await screen.findByLabelText("Password");
  fireEvent.change(passwordInput, { target: { value: "secret" } });

  const dialog = await screen.findByRole("alertdialog");
  fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);

  expect(mocks.deleteUser).toHaveBeenCalledWith(
    { password: "secret" },
    expect.any(Object),
  );

  const onSuccess = (
    mocks.deleteUser.mock.calls[0]?.[1] as { onSuccess: () => void } | undefined
  )?.onSuccess;
  onSuccess?.();
  expect(sonner.toastSuccess).toHaveBeenCalledWith("Account deleted");
  expect(mocks.auth.navigate).toHaveBeenCalledWith({
    to: "/auth/sign-in",
    replace: true,
  });
});

test("submits without password when sendDeleteAccountVerification is enabled", async () => {
  const sonner = mockSonner();
  const mocks = setupSettingsMocks({
    accounts: [
      { ...defaultAccount, id: "a1", accountId: "k", providerId: "credential" },
    ],
    auth: {
      deleteUser: { enabled: true, sendDeleteAccountVerification: true },
    },
  });
  const { DeleteUser } = await import(
    "~/components/settings/security/delete-user"
  );

  render(<DeleteUser />);

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Delete account" }));

  const dialog = await screen.findByRole("alertdialog");
  fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);

  expect(mocks.deleteUser).toHaveBeenCalledWith({}, expect.any(Object));
  expect(screen.queryByLabelText("Password")).toBeNull();

  const onSuccess = (
    mocks.deleteUser.mock.calls[0]?.[1] as { onSuccess: () => void } | undefined
  )?.onSuccess;
  onSuccess?.();
  expect(sonner.toastSuccess).toHaveBeenCalledWith("Verification email sent");
  expect(mocks.auth.navigate).not.toHaveBeenCalled();
});

test("submits without password when the user only has social accounts", async () => {
  mockSonner();
  const mocks = setupSettingsMocks({
    accounts: [
      { ...defaultAccount, id: "a2", accountId: "g", providerId: "github" },
    ],
  });
  const { DeleteUser } = await import(
    "~/components/settings/security/delete-user"
  );

  render(<DeleteUser />);

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Delete account" }));

  const dialog = await screen.findByRole("alertdialog");
  expect(screen.queryByLabelText("Password")).toBeNull();

  fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);
  expect(mocks.deleteUser).toHaveBeenCalledWith({}, expect.any(Object));
});

test("shows a spinner while deleting and disables the trigger before accounts load", async () => {
  mockSonner();
  setupSettingsMocks({
    accounts: null,
    pending: { deleteUser: true },
  });
  const { DeleteUser } = await import(
    "~/components/settings/security/delete-user"
  );

  render(<DeleteUser />);

  expect(screen.getByRole("button", { name: "Delete account" })).toBeDisabled();
});

test("clears password when toggling the dialog", async () => {
  mockSonner();
  setupSettingsMocks({
    accounts: [
      { ...defaultAccount, id: "a1", accountId: "k", providerId: "credential" },
    ],
  });
  const { DeleteUser } = await import(
    "~/components/settings/security/delete-user"
  );

  render(<DeleteUser />);

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Delete account" }));

  const passwordInput = await screen.findByLabelText("Password");
  fireEvent.change(passwordInput, { target: { value: "secret" } });

  await user.click(screen.getByRole("button", { name: "Cancel" }));

  await user.click(screen.getByRole("button", { name: "Delete account" }));
  expect(await screen.findByLabelText("Password")).toHaveValue("");
});
