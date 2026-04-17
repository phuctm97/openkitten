import type { ComponentProps, ReactNode, SVGProps } from "react";

import { vi } from "vitest";

type AuthState = {
  Link: (props: ComponentProps<"a">) => ReactNode;
  basePaths: {
    auth: string;
  };
  baseURL: string;
  emailAndPassword: {
    confirmPassword: boolean;
    enabled: boolean;
    forgotPassword: boolean;
    maxPasswordLength: number;
    minPasswordLength: number;
    rememberMe: boolean;
    requireEmailVerification: boolean;
  };
  localization: {
    auth: Record<string, string>;
  };
  magicLink: boolean;
  navigate: ReturnType<typeof vi.fn>;
  passkey: boolean;
  redirectTo: string;
  socialProviders: string[];
  username: {
    displayUsername: boolean;
    enabled: boolean;
    isUsernameAvailable: boolean;
    maxUsernameLength: number;
    minUsernameLength: number;
  };
  viewPaths: {
    auth: {
      forgotPassword: string;
      magicLink: string;
      resetPassword: string;
      signIn: string;
      signOut: string;
      signUp: string;
    };
  };
};

type MockFunction = ReturnType<typeof vi.fn>;

type MockSonnerToastResult = {
  toastError: MockFunction;
  toastSuccess: MockFunction;
};

type MockReactPacerResult = {
  maybeExecute: MockFunction;
};

type SetupBetterAuthUiMocksResult = {
  auth: AuthState;
  captured: CapturedOptions;
  checkUsernameAvailability: MockFunction;
  requestPasswordReset: MockFunction;
  resetPassword: MockFunction;
  resetUsernameAvailability: MockFunction;
  sendVerificationEmail: MockFunction;
  signInEmail: MockFunction;
  signInMagicLink: MockFunction;
  signInPasskey: MockFunction;
  signInSocial: MockFunction;
  signInUsername: MockFunction;
  signOut: MockFunction;
  signUpEmail: MockFunction;
};

type HookPendingState = Partial<
  Record<
    | "requestPasswordReset"
    | "resetPassword"
    | "signInEmail"
    | "signInMagicLink"
    | "signInPasskey"
    | "signInSocial"
    | "signInUsername"
    | "signOut"
    | "signUpEmail",
    boolean
  >
>;

type UsernameState = {
  data?: {
    available: boolean;
  };
  error?: {
    error?: {
      message?: string;
    };
    message?: string;
  };
};

type CapturedOptions = {
  requestPasswordReset?: {
    onError?: (error: { message?: string; statusText?: string }) => void;
    onSuccess?: () => void;
  };
  resetPassword?: {
    onError?: (error: {
      error?: { message?: string };
      message?: string;
    }) => void;
    onSuccess?: () => void;
  };
  sendVerificationEmail?: {
    onError?: (error: {
      error?: { message?: string };
      message?: string;
    }) => void;
    onSuccess?: () => void;
  };
  signInEmail?: {
    onError?: (
      error: {
        error?: { code?: string; message?: string };
        message?: string;
      },
      input: { email: string },
    ) => void;
    onSuccess?: () => void;
  };
  signInMagicLink?: {
    onError?: (error: {
      error?: { message?: string };
      message?: string;
    }) => void;
    onSuccess?: () => void;
  };
  signInPasskey?: {
    onError?: (error: {
      error?: { message?: string };
      message?: string;
    }) => void;
    onSuccess?: () => void;
  };
  signInSocial?: {
    onError?: (error: {
      error?: { message?: string };
      message?: string;
    }) => void;
    onSuccess?: () => void | Promise<void>;
  };
  signInUsername?: {
    onError?: (error: {
      error?: { message?: string };
      message?: string;
    }) => void;
    onSuccess?: () => void;
  };
  signOut?: {
    onError?: (error: {
      error?: { message?: string };
      message?: string;
    }) => void;
    onSuccess?: () => void;
  };
  signUpEmail?: {
    onError?: (error: {
      error?: { message?: string };
      message?: string;
    }) => void;
    onSuccess?: () => void;
  };
};

type SetupOptions = {
  auth?: Partial<AuthState>;
  pending?: HookPendingState;
  providerIcons?: Record<string, (props: SVGProps<SVGSVGElement>) => ReactNode>;
  username?: UsernameState;
};

function createLink({ children, href, ...props }: ComponentProps<"a">) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

function createLocalization() {
  return {
    auth: {
      alreadyHaveAnAccount: "Already have an account?",
      confirmPassword: "Confirm password",
      confirmPasswordPlaceholder: "Confirm your password",
      continueWith: "Continue with {{provider}}",
      email: "Email",
      emailPlaceholder: "hello@openkitten.dev",
      forgotPassword: "Forgot password",
      forgotPasswordLink: "Forgot your password?",
      hidePassword: "Hide password",
      invalidResetPasswordToken: "Reset password token is invalid",
      magicLink: "Magic link",
      magicLinkSent: "Magic link sent",
      name: "Name",
      namePlaceholder: "Open Kitten",
      needToCreateAnAccount: "Need to create an account?",
      newPasswordPlaceholder: "Choose a new password",
      or: "Or",
      passkey: "Passkey",
      password: "Password",
      passwordPlaceholder: "Enter your password",
      passwordResetEmailSent: "Password reset email sent",
      passwordResetSuccess: "Password reset successfully",
      passwordsDoNotMatch: "Passwords do not match",
      rememberMe: "Remember me",
      rememberYourPassword: "Remember your password?",
      resend: "Resend",
      resetPassword: "Reset password",
      sendMagicLink: "Send magic link",
      sendResetLink: "Send reset link",
      showPassword: "Show password",
      signIn: "Sign in",
      signUp: "Sign up",
      username: "Username",
      usernameOrEmailPlaceholder: "Username or email",
      usernamePlaceholder: "openkitten",
      usernameTaken: "Username is already taken",
      verificationEmailSent: "Verification email sent",
      verifyYourEmail: "Verify your email",
    },
  };
}

function createAuthState(overrides: Partial<AuthState> = {}): AuthState {
  const navigate = overrides.navigate ?? vi.fn();

  return {
    Link: overrides.Link ?? createLink,
    basePaths: {
      auth: overrides.basePaths?.auth ?? "/auth",
    },
    baseURL: overrides.baseURL ?? "https://world.openkitten.dev",
    emailAndPassword: {
      confirmPassword: overrides.emailAndPassword?.confirmPassword ?? true,
      enabled: overrides.emailAndPassword?.enabled ?? true,
      forgotPassword: overrides.emailAndPassword?.forgotPassword ?? true,
      maxPasswordLength: overrides.emailAndPassword?.maxPasswordLength ?? 64,
      minPasswordLength: overrides.emailAndPassword?.minPasswordLength ?? 8,
      rememberMe: overrides.emailAndPassword?.rememberMe ?? true,
      requireEmailVerification:
        overrides.emailAndPassword?.requireEmailVerification ?? false,
    },
    localization: overrides.localization ?? createLocalization(),
    magicLink: overrides.magicLink ?? true,
    navigate,
    passkey: overrides.passkey ?? true,
    redirectTo: overrides.redirectTo ?? "/play",
    socialProviders: overrides.socialProviders ?? ["github", "google"],
    username: {
      displayUsername: overrides.username?.displayUsername ?? false,
      enabled: overrides.username?.enabled ?? false,
      isUsernameAvailable: overrides.username?.isUsernameAvailable ?? false,
      maxUsernameLength: overrides.username?.maxUsernameLength ?? 20,
      minUsernameLength: overrides.username?.minUsernameLength ?? 3,
    },
    viewPaths: {
      auth: {
        forgotPassword:
          overrides.viewPaths?.auth?.forgotPassword ?? "forgot-password",
        magicLink: overrides.viewPaths?.auth?.magicLink ?? "magic-link",
        resetPassword:
          overrides.viewPaths?.auth?.resetPassword ?? "reset-password",
        signIn: overrides.viewPaths?.auth?.signIn ?? "sign-in",
        signOut: overrides.viewPaths?.auth?.signOut ?? "sign-out",
        signUp: overrides.viewPaths?.auth?.signUp ?? "sign-up",
      },
    },
  };
}

export function mockSonnerToast(): MockSonnerToastResult {
  const toastError = vi.fn();
  const toastSuccess = vi.fn();

  vi.doMock("sonner", () => ({
    toast: {
      error: toastError,
      success: toastSuccess,
    },
  }));

  return {
    toastError,
    toastSuccess,
  };
}

export function mockReactPacer(): MockReactPacerResult {
  const maybeExecute = vi.fn();

  vi.doMock("@tanstack/react-pacer", () => ({
    useDebouncer: (callback: (value: string) => void) => ({
      maybeExecute: (value: string) => {
        maybeExecute(value);
        callback(value);
      },
    }),
  }));

  return {
    maybeExecute,
  };
}

export function setupBetterAuthUiMocks(
  options: SetupOptions = {},
): SetupBetterAuthUiMocksResult {
  const auth = createAuthState(options.auth);
  const providerIcons = options.providerIcons ?? {
    github: (props: SVGProps<SVGSVGElement>) => (
      <svg data-testid="provider-icon-github" {...props} />
    ),
    google: (props: SVGProps<SVGSVGElement>) => (
      <svg data-testid="provider-icon-google" {...props} />
    ),
  };

  const captured: CapturedOptions = {};

  const requestPasswordReset = vi.fn();
  const resetPassword = vi.fn();
  const sendVerificationEmail = vi.fn();
  const signInEmail = vi.fn();
  const signInMagicLink = vi.fn();
  const signInPasskey = vi.fn();
  const signInSocial = vi.fn();
  const signInUsername = vi.fn();
  const signOut = vi.fn();
  const signUpEmail = vi.fn();
  const checkUsernameAvailability = vi.fn();
  const resetUsernameAvailability = vi.fn();

  vi.doMock("@better-auth-ui/react", () => ({
    providerIcons,
    useAuth: () => auth,
    useIsUsernameAvailable: () => ({
      data: options.username?.data,
      error: options.username?.error,
      mutate: checkUsernameAvailability,
      reset: resetUsernameAvailability,
    }),
    useRequestPasswordReset: (
      config: CapturedOptions["requestPasswordReset"],
    ) => {
      captured.requestPasswordReset = config;

      return {
        mutate: requestPasswordReset,
        isPending: options.pending?.requestPasswordReset ?? false,
      };
    },
    useResetPassword: (config: CapturedOptions["resetPassword"]) => {
      captured.resetPassword = config;

      return {
        mutate: resetPassword,
        isPending: options.pending?.resetPassword ?? false,
      };
    },
    useSendVerificationEmail: (
      config: CapturedOptions["sendVerificationEmail"],
    ) => {
      captured.sendVerificationEmail = config;

      return {
        mutate: sendVerificationEmail,
      };
    },
    useSignInEmail: (config: CapturedOptions["signInEmail"]) => {
      captured.signInEmail = config;

      return {
        mutate: signInEmail,
        isPending: options.pending?.signInEmail ?? false,
      };
    },
    useSignInMagicLink: (config: CapturedOptions["signInMagicLink"]) => {
      captured.signInMagicLink = config;

      return {
        mutate: signInMagicLink,
        isPending: options.pending?.signInMagicLink ?? false,
      };
    },
    useSignInPasskey: (config: CapturedOptions["signInPasskey"]) => {
      captured.signInPasskey = config;

      return {
        mutate: signInPasskey,
        isPending: options.pending?.signInPasskey ?? false,
      };
    },
    useSignInSocial: (config: CapturedOptions["signInSocial"]) => {
      captured.signInSocial = config;

      return {
        mutate: signInSocial,
        isPending: options.pending?.signInSocial ?? false,
      };
    },
    useSignInUsername: (config: CapturedOptions["signInUsername"]) => {
      captured.signInUsername = config;

      return {
        mutate: signInUsername,
        isPending: options.pending?.signInUsername ?? false,
      };
    },
    useSignOut: (config: CapturedOptions["signOut"]) => {
      captured.signOut = config;

      return {
        mutate: signOut,
        isPending: options.pending?.signOut ?? false,
      };
    },
    useSignUpEmail: (config: CapturedOptions["signUpEmail"]) => {
      captured.signUpEmail = config;

      return {
        mutate: signUpEmail,
        isPending: options.pending?.signUpEmail ?? false,
      };
    },
  }));

  vi.doMock("@better-auth-ui/react/core", () => ({
    getProviderName: (provider: string) =>
      provider
        .split(/[-_]/u)
        .map(
          (segment) => `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`,
        )
        .join(" "),
  }));

  return {
    auth,
    captured,
    checkUsernameAvailability,
    requestPasswordReset,
    resetPassword,
    resetUsernameAvailability,
    sendVerificationEmail,
    signInEmail,
    signInMagicLink,
    signInPasskey,
    signInSocial,
    signInUsername,
    signOut,
    signUpEmail,
  };
}
