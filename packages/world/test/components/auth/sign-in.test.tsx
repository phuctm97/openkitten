import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  mockSonnerToast,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

function mockNestedAuthComponents() {
  vi.doMock("~/components/auth/magic-link-button", () => ({
    MagicLinkButton: ({
      isPending,
      view,
    }: {
      isPending: boolean;
      view?: string;
    }) => (
      <div
        data-testid="magic-link-button"
        data-pending={String(isPending)}
        data-view={view}
      />
    ),
  }));

  vi.doMock("~/components/auth/passkey-button", () => ({
    PasskeyButton: ({ isPending }: { isPending: boolean }) => (
      <div data-testid="passkey-button" data-pending={String(isPending)} />
    ),
  }));

  vi.doMock("~/components/auth/provider-buttons", () => ({
    ProviderButtons: ({
      isPending,
      socialLayout,
    }: {
      isPending: boolean;
      socialLayout?: string;
    }) => (
      <div
        data-testid="provider-buttons"
        data-pending={String(isPending)}
        data-social-layout={socialLayout}
      />
    ),
  }));
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("submits email sign-in, clears field errors, and handles generic errors", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks();
  mockNestedAuthComponents();
  const { SignIn } = await import("~/components/auth/sign-in");

  render(<SignIn className="sign-in-card" socialLayout="grid" />);

  const emailInput = screen.getByLabelText("Email");
  const passwordInput = screen.getByLabelText("Password");

  Object.defineProperty(emailInput, "validationMessage", {
    configurable: true,
    value: "Email is required",
  });
  Object.defineProperty(passwordInput, "validationMessage", {
    configurable: true,
    value: "Password is required",
  });

  fireEvent.invalid(emailInput);
  fireEvent.invalid(passwordInput);

  expect(screen.getAllByRole("alert")).toHaveLength(2);

  fireEvent.change(emailInput, { target: { value: "sign-in@openkitten.dev" } });
  fireEvent.change(passwordInput, { target: { value: "pawsword123" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Remember me" }));
  fireEvent.submit(screen.getByRole("button", { name: "Sign in" }));

  expect(screen.queryByRole("alert")).toBeNull();
  expect(mocks.signInEmail).toHaveBeenCalledWith({
    email: "sign-in@openkitten.dev",
    password: "pawsword123",
    rememberMe: true,
  });
  expect(screen.getByTestId("provider-buttons")).toHaveAttribute(
    "data-social-layout",
    "grid",
  );
  expect(screen.getByTestId("magic-link-button")).toHaveAttribute(
    "data-view",
    "signIn",
  );
  expect(screen.getByTestId("passkey-button")).toHaveAttribute(
    "data-pending",
    "false",
  );
  expect(
    screen.getByRole("link", { name: "Forgot your password?" }),
  ).toHaveAttribute("href", "/auth/forgot-password");

  await act(async () => {
    mocks.captured.signInEmail?.onError?.(
      { message: "Invalid credentials" },
      { email: "sign-in@openkitten.dev" },
    );
  });

  await act(async () => {
    mocks.captured.signInEmail?.onSuccess?.();
  });

  expect(passwordInput).toHaveValue("");
  expect(toast.toastError).toHaveBeenCalledWith("Invalid credentials");
  expect(mocks.auth.navigate).toHaveBeenCalledWith({ to: "/play" });
});

test("offers to resend verification emails when sign-in requires verification", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks();
  mockNestedAuthComponents();
  const { SignIn } = await import("~/components/auth/sign-in");

  render(<SignIn />);

  mocks.captured.signInEmail?.onError?.(
    {
      error: {
        code: "EMAIL_NOT_VERIFIED",
      },
      message: "Verify your email with the fallback message",
    },
    { email: "verify@openkitten.dev" },
  );
  mocks.captured.signInEmail?.onError?.(
    {
      error: {
        code: "EMAIL_NOT_VERIFIED",
        message: "Verify your email first",
      },
    },
    { email: "verify@openkitten.dev" },
  );

  const toastCall = toast.toastError.mock.calls[0];
  const toastOptions = toastCall?.[1];

  expect(toast.toastError).toHaveBeenCalledWith(
    "Verify your email first",
    expect.objectContaining({
      action: expect.objectContaining({
        label: "Resend",
      }),
    }),
  );

  toastOptions?.action?.onClick();

  expect(mocks.sendVerificationEmail).toHaveBeenCalledWith({
    callbackURL: "https://world.openkitten.dev/play",
    email: "verify@openkitten.dev",
  });

  mocks.captured.sendVerificationEmail?.onSuccess?.();
  mocks.captured.sendVerificationEmail?.onError?.({
    message: "Resend failed",
  });

  expect(toast.toastSuccess).toHaveBeenCalledWith("Verification email sent");
  expect(toast.toastError).toHaveBeenCalledWith("Resend failed");
});

test("signs in with a username when username auth is enabled", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    auth: {
      socialProviders: [],
      username: {
        displayUsername: false,
        enabled: true,
        isUsernameAvailable: false,
        maxUsernameLength: 20,
        minUsernameLength: 3,
      },
    },
  });
  mockNestedAuthComponents();
  const { SignIn } = await import("~/components/auth/sign-in");

  render(<SignIn />);

  const identityInput = screen.getByLabelText("Username");
  const passwordInput = screen.getByLabelText("Password");

  fireEvent.change(identityInput, { target: { value: "openkitten" } });
  fireEvent.change(passwordInput, { target: { value: "house-party" } });
  fireEvent.submit(screen.getByRole("button", { name: "Sign in" }));

  expect(mocks.signInUsername).toHaveBeenCalledWith({
    password: "house-party",
    username: "openkitten",
  });

  await act(async () => {
    mocks.captured.signInUsername?.onError?.({
      message: "Unknown username fallback",
    });
  });

  await act(async () => {
    mocks.captured.signInUsername?.onError?.({
      error: { message: "Unknown username" },
    });
  });

  await act(async () => {
    mocks.captured.signInUsername?.onSuccess?.();
  });

  expect(toast.toastError).toHaveBeenCalledWith("Unknown username fallback");
  expect(passwordInput).toHaveValue("");
  expect(toast.toastError).toHaveBeenCalledWith("Unknown username");
  expect(mocks.auth.navigate).toHaveBeenCalledWith({ to: "/play" });
});

test("supports social-only sign-in flows and clears redirecting state", async () => {
  vi.useFakeTimers();

  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    auth: {
      emailAndPassword: {
        confirmPassword: true,
        enabled: false,
        forgotPassword: true,
        maxPasswordLength: 64,
        minPasswordLength: 8,
        rememberMe: true,
        requireEmailVerification: false,
      },
      magicLink: false,
      passkey: false,
      socialProviders: ["github"],
    },
  });
  mockNestedAuthComponents();
  const { SignIn } = await import("~/components/auth/sign-in");

  render(<SignIn socialPosition="top" />);

  expect(screen.queryByLabelText("Email")).toBeNull();
  expect(screen.getByTestId("provider-buttons")).toHaveAttribute(
    "data-pending",
    "false",
  );
  expect(screen.queryByText("Or")).toBeNull();
  expect(screen.queryByTestId("magic-link-button")).toBeNull();
  expect(screen.queryByTestId("passkey-button")).toBeNull();

  await act(async () => {
    await mocks.captured.signInSocial?.onSuccess?.();
  });

  expect(screen.getByTestId("provider-buttons")).toHaveAttribute(
    "data-pending",
    "true",
  );

  await act(async () => {
    vi.advanceTimersByTime(5000);
  });

  expect(screen.getByTestId("provider-buttons")).toHaveAttribute(
    "data-pending",
    "false",
  );

  mocks.captured.signInSocial?.onError?.({
    error: { message: "Social sign-in failed" },
  });
  mocks.captured.signInSocial?.onError?.({ message: "Social fallback failed" });

  expect(toast.toastError).toHaveBeenCalledWith("Social sign-in failed");
  expect(toast.toastError).toHaveBeenCalledWith("Social fallback failed");
});

test("renders top social separators and omits remember-me when disabled", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    auth: {
      emailAndPassword: {
        confirmPassword: true,
        enabled: true,
        forgotPassword: true,
        maxPasswordLength: 64,
        minPasswordLength: 8,
        rememberMe: false,
        requireEmailVerification: false,
      },
      socialProviders: ["github"],
    },
  });
  mockNestedAuthComponents();
  const { SignIn } = await import("~/components/auth/sign-in");

  render(<SignIn socialPosition="top" />);

  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "top@openkitten.dev" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "house-party" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Sign in" }));

  expect(screen.getByText("Or")).toBeInTheDocument();
  expect(screen.queryByRole("checkbox", { name: "Remember me" })).toBeNull();
  expect(mocks.signInEmail).toHaveBeenCalledWith({
    email: "top@openkitten.dev",
    password: "house-party",
  });

  mocks.captured.sendVerificationEmail?.onError?.({
    error: { message: "Nested resend failure" },
  });

  expect(toast.toastError).toHaveBeenCalledWith("Nested resend failure");
});

test("shows a spinner while email sign-in is pending", async () => {
  mockSonnerToast();
  setupBetterAuthUiMocks({
    pending: {
      signInEmail: true,
    },
  });
  mockNestedAuthComponents();
  const { SignIn } = await import("~/components/auth/sign-in");

  render(<SignIn />);

  expect(screen.getByRole("button", { name: /Sign in/u })).toBeDisabled();
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});
