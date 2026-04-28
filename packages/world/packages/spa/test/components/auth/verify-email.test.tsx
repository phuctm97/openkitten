import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  mockSonnerToast,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("resends the verification email pointed at /auth-callback", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    session: {
      data: {
        user: {
          email: "kitten@openkitten.dev",
          emailVerified: false,
          id: "user-1",
        },
      },
    },
  });
  const { VerifyEmail } = await import("~/components/auth/verify-email");

  render(<VerifyEmail className="verify-card" />);

  expect(screen.getByText("kitten@openkitten.dev")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Resend/u }));

  expect(mocks.sendVerificationEmail).toHaveBeenCalledWith({
    email: "kitten@openkitten.dev",
    callbackURL: "http://localhost:41238/auth-callback",
  });

  mocks.captured.sendVerificationEmail?.onSuccess?.();
  expect(toast.toastSuccess).toHaveBeenCalledWith("Verification email sent");
});

test("hides the resend button when no email is loaded", async () => {
  mockSonnerToast();
  setupBetterAuthUiMocks({
    session: { data: null },
  });
  const { VerifyEmail } = await import("~/components/auth/verify-email");

  render(<VerifyEmail />);

  expect(screen.getByText("your inbox")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Resend/u })).toBeNull();
});

test("signs the user out and routes them back to sign-in", async () => {
  mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    session: {
      data: {
        user: {
          email: "kitten@openkitten.dev",
          emailVerified: false,
          id: "user-1",
        },
      },
    },
  });
  const { VerifyEmail } = await import("~/components/auth/verify-email");

  render(<VerifyEmail />);

  fireEvent.click(screen.getByRole("button", { name: /Sign out/u }));

  expect(mocks.signOut).toHaveBeenCalledTimes(1);

  mocks.captured.signOut?.onSuccess?.();
  expect(mocks.auth.navigate).toHaveBeenCalledWith({
    to: "/auth/sign-in",
    replace: true,
  });
});

test("toasts errors and routes back to sign-in when sign-out fails", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    session: {
      data: {
        user: {
          email: "kitten@openkitten.dev",
          emailVerified: false,
          id: "user-1",
        },
      },
    },
  });
  const { VerifyEmail } = await import("~/components/auth/verify-email");

  render(<VerifyEmail />);

  mocks.captured.signOut?.onError?.({ message: "Sign-out failed" });

  expect(toast.toastError).toHaveBeenCalledWith("Sign-out failed");
  expect(mocks.auth.navigate).toHaveBeenCalledWith({
    to: "/auth/sign-in",
    replace: true,
  });
});

test("disables both buttons and shows a spinner while resending", async () => {
  mockSonnerToast();
  setupBetterAuthUiMocks({
    pending: {
      sendVerificationEmail: true,
    },
    session: {
      data: {
        user: {
          email: "kitten@openkitten.dev",
          emailVerified: false,
          id: "user-1",
        },
      },
    },
  });
  const { VerifyEmail } = await import("~/components/auth/verify-email");

  render(<VerifyEmail />);

  expect(screen.getByRole("button", { name: /Resend/u })).toBeDisabled();
  expect(screen.getByRole("button", { name: /Sign out/u })).toBeDisabled();
  expect(screen.getAllByRole("status")[0]).toBeInTheDocument();
});

test("shows a spinner on the sign-out button while signing out", async () => {
  mockSonnerToast();
  setupBetterAuthUiMocks({
    pending: {
      signOut: true,
    },
    session: {
      data: {
        user: {
          email: "kitten@openkitten.dev",
          emailVerified: false,
          id: "user-1",
        },
      },
    },
  });
  const { VerifyEmail } = await import("~/components/auth/verify-email");

  render(<VerifyEmail />);

  expect(screen.getByRole("button", { name: /Sign out/u })).toBeDisabled();
});
