import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  mockReactPacer,
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
});

afterEach(() => {
  vi.useRealTimers();
});

test("submits a basic sign-up form and navigates directly on success", {
  timeout: 10_000,
}, async () => {
  mockReactPacer();
  mockSonnerToast();
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
  mockNestedAuthComponents();
  const { SignUp } = await import("~/components/auth/sign-up");

  render(<SignUp className="sign-up-card" socialLayout="grid" />);

  const nameInput = screen.getByLabelText("Name");
  const emailInput = screen.getByLabelText("Email");
  const passwordInput = screen.getByLabelText("Password");

  Object.defineProperty(nameInput, "validationMessage", {
    configurable: true,
    value: "Name is required",
  });
  Object.defineProperty(emailInput, "validationMessage", {
    configurable: true,
    value: "Email is required",
  });

  fireEvent.invalid(nameInput);
  fireEvent.invalid(emailInput);

  expect(screen.getAllByRole("alert")).toHaveLength(2);

  fireEvent.change(nameInput, { target: { value: "Open Kitten" } });
  fireEvent.change(emailInput, { target: { value: "sign-up@openkitten.dev" } });
  fireEvent.change(passwordInput, { target: { value: "house-party-123" } });
  fireEvent.submit(screen.getByRole("button", { name: "Sign up" }));

  expect(screen.queryByRole("alert")).toBeNull();
  expect(mocks.signUpEmail).toHaveBeenCalledWith({
    email: "sign-up@openkitten.dev",
    name: "Open Kitten",
    password: "house-party-123",
  });
  expect(screen.getByTestId("magic-link-button")).toHaveAttribute(
    "data-view",
    "signUp",
  );
  expect(screen.getByTestId("provider-buttons")).toHaveAttribute(
    "data-social-layout",
    "grid",
  );

  mocks.captured.signUpEmail?.onSuccess?.();

  expect(mocks.auth.navigate).toHaveBeenCalledWith({ to: "/play" });
  expect(screen.queryByLabelText("Confirm password")).toBeNull();
});

test("routes verified-email sign-ups back to sign-in", async () => {
  mockReactPacer();
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
        requireEmailVerification: true,
      },
    },
  });
  mockNestedAuthComponents();
  const { SignUp } = await import("~/components/auth/sign-up");

  render(<SignUp />);

  mocks.captured.signUpEmail?.onSuccess?.();

  expect(toast.toastSuccess).toHaveBeenCalledWith("Verify your email");
  expect(mocks.auth.navigate).toHaveBeenCalledWith({ to: "/auth/sign-in" });
});

test("clears password fields when confirmation fails or the API returns an error", async () => {
  mockReactPacer();
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks();
  mockNestedAuthComponents();
  const { SignUp } = await import("~/components/auth/sign-up");

  render(<SignUp />);

  const passwordInput = screen.getByLabelText("Password");
  const confirmPasswordInput = screen.getByLabelText("Confirm password");

  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Open Kitten" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "sign-up@openkitten.dev" },
  });
  fireEvent.change(passwordInput, { target: { value: "secret-pass" } });
  fireEvent.change(confirmPasswordInput, { target: { value: "other-pass" } });
  fireEvent.submit(screen.getByRole("button", { name: "Sign up" }));

  expect(toast.toastError).toHaveBeenCalledWith("Passwords do not match");
  expect(passwordInput).toHaveValue("");
  expect(confirmPasswordInput).toHaveValue("");
  expect(mocks.signUpEmail).not.toHaveBeenCalled();

  fireEvent.change(passwordInput, { target: { value: "secret-pass" } });
  fireEvent.change(confirmPasswordInput, { target: { value: "secret-pass" } });

  await act(async () => {
    mocks.captured.signUpEmail?.onError?.({
      message: "Sign-up fallback failed",
    });
  });

  await act(async () => {
    mocks.captured.signUpEmail?.onError?.({
      error: { message: "Sign-up failed" },
    });
  });

  expect(toast.toastError).toHaveBeenCalledWith("Sign-up fallback failed");
  expect(passwordInput).toHaveValue("");
  expect(confirmPasswordInput).toHaveValue("");
  expect(toast.toastError).toHaveBeenCalledWith("Sign-up failed");
});

test("validates sign-up password fields and toggles password visibility", async () => {
  mockReactPacer();
  mockSonnerToast();
  setupBetterAuthUiMocks();
  mockNestedAuthComponents();
  const { SignUp } = await import("~/components/auth/sign-up");

  render(<SignUp />);

  const passwordInput = screen.getByLabelText("Password");
  const confirmPasswordInput = screen.getByLabelText("Confirm password");

  Object.defineProperty(passwordInput, "validationMessage", {
    configurable: true,
    value: "Choose a password",
  });
  Object.defineProperty(confirmPasswordInput, "validationMessage", {
    configurable: true,
    value: "Confirm your password",
  });

  fireEvent.invalid(passwordInput);
  fireEvent.invalid(confirmPasswordInput);

  expect(screen.getAllByRole("alert")).toHaveLength(2);

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

  fireEvent.change(passwordInput, { target: { value: "secret-pass" } });
  fireEvent.change(confirmPasswordInput, { target: { value: "secret-pass" } });

  expect(screen.queryByRole("alert")).toBeNull();
});

test("checks username availability and includes username fields in sign-up payloads", async () => {
  const pacer = mockReactPacer();
  mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    auth: {
      username: {
        displayUsername: true,
        enabled: true,
        isUsernameAvailable: true,
        maxUsernameLength: 20,
        minUsernameLength: 3,
      },
    },
    username: {
      data: {
        available: true,
      },
    },
  });
  mockNestedAuthComponents();
  const { SignUp } = await import("~/components/auth/sign-up");

  render(<SignUp />);

  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "openkitten" },
  });
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Open Kitten" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "username@openkitten.dev" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "secret-pass" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "secret-pass" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Sign up" }));

  expect(pacer.maybeExecute).toHaveBeenCalledWith("openkitten");
  expect(mocks.checkUsernameAvailability).toHaveBeenCalledWith({
    username: "openkitten",
  });
  expect(mocks.signUpEmail).toHaveBeenCalledWith({
    displayUsername: "openkitten",
    email: "username@openkitten.dev",
    name: "Open Kitten",
    password: "secret-pass",
    username: "openkitten",
  });
  expect(
    screen
      .getByLabelText("Username")
      .closest('[data-slot="input-group"]')
      ?.querySelector("svg"),
  ).not.toBeNull();
});

test("shows username loading and unavailable states", async () => {
  const pacer = mockReactPacer();
  mockSonnerToast();
  const loadingMocks = setupBetterAuthUiMocks({
    auth: {
      socialProviders: [],
      username: {
        displayUsername: false,
        enabled: true,
        isUsernameAvailable: true,
        maxUsernameLength: 20,
        minUsernameLength: 3,
      },
    },
  });
  mockNestedAuthComponents();
  const { SignUp: LoadingSignUp } = await import("~/components/auth/sign-up");

  const { unmount } = render(<LoadingSignUp />);

  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "loading-name" },
  });

  expect(pacer.maybeExecute).toHaveBeenCalledWith("loading-name");
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();

  unmount();
  vi.resetModules();

  mockReactPacer();
  mockSonnerToast();
  const unavailableMocks = setupBetterAuthUiMocks({
    auth: {
      socialProviders: [],
      username: {
        displayUsername: false,
        enabled: true,
        isUsernameAvailable: true,
        maxUsernameLength: 20,
        minUsernameLength: 3,
      },
    },
    username: {
      data: {
        available: false,
      },
    },
  });
  mockNestedAuthComponents();
  const { SignUp: UnavailableSignUp } = await import(
    "~/components/auth/sign-up"
  );

  render(<UnavailableSignUp />);

  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "taken-name" },
  });

  expect(unavailableMocks.checkUsernameAvailability).toHaveBeenCalledWith({
    username: "taken-name",
  });
  expect(screen.getByText("Username is already taken")).toBeInTheDocument();
  expect(
    screen
      .getByLabelText("Username")
      .closest('[data-slot="input-group"]')
      ?.querySelector("svg"),
  ).not.toBeNull();

  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "   " },
  });

  expect(loadingMocks.resetUsernameAvailability).toHaveBeenCalled();
  expect(unavailableMocks.resetUsernameAvailability).toHaveBeenCalled();
});

test("shows username availability API errors", async () => {
  mockReactPacer();
  mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    auth: {
      socialProviders: [],
      username: {
        displayUsername: false,
        enabled: true,
        isUsernameAvailable: true,
        maxUsernameLength: 20,
        minUsernameLength: 3,
      },
    },
    username: {
      error: {
        error: {
          message: "Username lookup failed",
        },
      },
    },
  });
  mockNestedAuthComponents();
  const { SignUp } = await import("~/components/auth/sign-up");

  render(<SignUp />);

  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "broken-name" },
  });

  expect(mocks.checkUsernameAvailability).toHaveBeenCalledWith({
    username: "broken-name",
  });
  expect(screen.getByText("Username lookup failed")).toBeInTheDocument();
});

test("supports social-only sign-up flows", async () => {
  mockReactPacer();
  mockSonnerToast();
  setupBetterAuthUiMocks({
    auth: {
      emailAndPassword: {
        confirmPassword: false,
        enabled: false,
        forgotPassword: true,
        maxPasswordLength: 64,
        minPasswordLength: 8,
        rememberMe: true,
        requireEmailVerification: false,
      },
      magicLink: false,
      socialProviders: ["github"],
    },
  });
  mockNestedAuthComponents();
  const { SignUp } = await import("~/components/auth/sign-up");

  render(<SignUp socialPosition="top" />);

  expect(screen.queryByLabelText("Name")).toBeNull();
  expect(screen.getByTestId("provider-buttons")).toHaveAttribute(
    "data-pending",
    "false",
  );
  expect(screen.queryByText("Or")).toBeNull();
  expect(screen.queryByTestId("magic-link-button")).toBeNull();
});

test("renders top separators and omits display usernames when disabled", async () => {
  mockReactPacer();
  mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    auth: {
      socialProviders: ["github"],
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
  const { SignUp } = await import("~/components/auth/sign-up");

  render(<SignUp socialPosition="top" />);

  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "nodisplay" },
  });
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Open Kitten" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "nodisplay@openkitten.dev" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "secret-pass" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "secret-pass" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Sign up" }));

  expect(screen.getByText("Or")).toBeInTheDocument();
  expect(mocks.signUpEmail).toHaveBeenCalledWith({
    email: "nodisplay@openkitten.dev",
    name: "Open Kitten",
    password: "secret-pass",
    username: "nodisplay",
  });
});

test("shows a spinner while sign-up is pending", async () => {
  mockReactPacer();
  mockSonnerToast();
  setupBetterAuthUiMocks({
    pending: {
      signUpEmail: true,
    },
  });
  mockNestedAuthComponents();
  const { SignUp } = await import("~/components/auth/sign-up");

  render(<SignUp />);

  expect(screen.getByRole("button", { name: /Sign up/u })).toBeDisabled();
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});
