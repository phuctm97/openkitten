import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  mockSonnerToast,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

test("starts passkey sign-in and handles success and error callbacks", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks();
  const { PasskeyButton } = await import("~/components/auth/passkey-button");

  render(<PasskeyButton isPending={false} />);

  const button = screen.getByRole("button", { name: "Continue with Passkey" });

  fireEvent.click(button);

  expect(mocks.signInPasskey).toHaveBeenCalledTimes(1);

  mocks.captured.signInPasskey?.onSuccess?.();
  mocks.captured.signInPasskey?.onError?.({
    message: "Passkey failed",
  });
  mocks.captured.signInPasskey?.onError?.({
    error: { message: "Passkey rejected" },
  });

  expect(mocks.auth.navigate).toHaveBeenCalledWith({ to: "/play" });
  expect(toast.toastError).toHaveBeenCalledWith("Passkey failed");
  expect(toast.toastError).toHaveBeenCalledWith("Passkey rejected");
});

test("disables the button while the parent flow is pending", async () => {
  mockSonnerToast();
  setupBetterAuthUiMocks();
  const { PasskeyButton } = await import("~/components/auth/passkey-button");

  render(<PasskeyButton isPending />);

  expect(
    screen.getByRole("button", { name: "Continue with Passkey" }),
  ).toBeDisabled();
  expect(screen.queryByRole("status", { name: "Loading" })).toBeNull();
});

test("shows a spinner while passkey sign-in is pending", async () => {
  mockSonnerToast();
  setupBetterAuthUiMocks({
    pending: {
      signInPasskey: true,
    },
  });
  const { PasskeyButton } = await import("~/components/auth/passkey-button");

  render(<PasskeyButton isPending={false} />);

  expect(screen.getByRole("button")).toBeDisabled();
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});
