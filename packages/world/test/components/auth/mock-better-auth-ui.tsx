import type { ComponentProps, ReactNode, SVGProps } from "react";

import { vi } from "vitest";

type MockFunction = ReturnType<typeof vi.fn>;

type AuthUser = {
  createdAt: Date;
  displayUsername?: string | null;
  email: string;
  emailVerified: boolean;
  id: string;
  image?: string | null;
  name: string;
  updatedAt: Date;
  username?: string | null;
};

type SessionRecord = {
  session: {
    createdAt: Date;
    expiresAt: Date;
    id: string;
    ipAddress?: string | null;
    token: string;
    updatedAt: Date;
    userId: string;
    userAgent?: string | null;
  };
  user: AuthUser;
};

type AccountRecord = {
  accountId: string;
  createdAt: Date;
  id: string;
  providerId: string;
  updatedAt: Date;
  userId: string;
};

type PasskeyRecord = {
  createdAt: Date;
  id: string;
  name?: string | null;
};

type AccountInfoState = {
  data?: Record<string, string | undefined>;
  user?: {
    email?: string;
    name?: string;
  };
};

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (...args: never[]) => unknown
    ? T[K]
    : T[K] extends Array<infer U>
      ? Array<DeepPartial<U>>
      : T[K] extends object
        ? DeepPartial<T[K]>
        : T[K];
};

type AuthState = {
  Link: (props: ComponentProps<"a">) => ReactNode;
  appearance: {
    setTheme?: MockFunction;
    theme: string;
    themes: string[];
  };
  avatar: {
    delete?: MockFunction;
    extension: string;
    resize?: MockFunction;
    size: number;
    upload?: MockFunction;
  };
  basePaths: {
    auth: string;
    settings: string;
  };
  baseURL: string;
  deleteUser: {
    enabled: boolean;
    sendDeleteAccountVerification: boolean;
  };
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
    settings: Record<string, string>;
  };
  magicLink: boolean;
  multiSession: boolean;
  navigate: (options: { replace?: boolean; to: string }) => void;
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
    settings: {
      account: string;
      security: string;
    };
  };
};

type MockSonnerToastResult = {
  toastError: MockFunction;
  toastSuccess: MockFunction;
};

type MockReactPacerResult = {
  maybeExecute: MockFunction;
};

type HookPendingState = Partial<
  Record<
    | "accountInfo"
    | "addPasskey"
    | "changeEmail"
    | "changePassword"
    | "deletePasskey"
    | "deleteUser"
    | "linkSocial"
    | "listAccounts"
    | "listDeviceSessions"
    | "listSessions"
    | "listUserPasskeys"
    | "requestPasswordReset"
    | "resetPassword"
    | "revokeMultiSession"
    | "revokeSession"
    | "session"
    | "setActiveSession"
    | "signInEmail"
    | "signInMagicLink"
    | "signInPasskey"
    | "signInSocial"
    | "signInUsername"
    | "signOut"
    | "signUpEmail"
    | "unlinkAccount"
    | "updateUser",
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

type MutationCallbacks = {
  onError?: (error: {
    error?: { code?: string; message?: string };
    message?: string;
    statusText?: string;
  }) => void;
  onSuccess?: () => void;
};

type CapturedOptions = {
  accountInfo?: {
    throwOnError?: (error: {
      error?: { message?: string };
      message?: string;
    }) => boolean;
  };
  addPasskey?: MutationCallbacks;
  changeEmail?: MutationCallbacks;
  changePassword?: MutationCallbacks;
  deletePasskey?: MutationCallbacks;
  deleteUser?: MutationCallbacks;
  linkSocial?: MutationCallbacks;
  listAccounts?: {
    throwOnError?: (error: {
      error?: { message?: string };
      message?: string;
    }) => boolean;
  };
  listDeviceSessions?: {
    throwOnError?: (error: {
      error?: { message?: string };
      message?: string;
    }) => boolean;
  };
  listSessions?: {
    throwOnError?: (error: {
      error?: { message?: string };
      message?: string;
    }) => boolean;
  };
  listUserPasskeys?: {
    throwOnError?: (error: {
      error?: { message?: string };
      message?: string;
    }) => boolean;
  };
  requestPasswordReset?: {
    onError?: (error: {
      error?: { message?: string };
      message?: string;
      statusText?: string;
    }) => void;
    onSuccess?: () => void;
  };
  resetPassword?: MutationCallbacks;
  revokeMultiSession?: MutationCallbacks;
  revokeSession?: MutationCallbacks;
  sendVerificationEmail?: MutationCallbacks;
  setActiveSession?: MutationCallbacks;
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
  signInMagicLink?: MutationCallbacks;
  signInPasskey?: MutationCallbacks;
  signInSocial?: {
    onError?: (error: {
      error?: { message?: string };
      message?: string;
    }) => void;
    onSuccess?: () => void | Promise<void>;
  };
  signInUsername?: MutationCallbacks;
  signOut?: MutationCallbacks;
  signUpEmail?: MutationCallbacks;
  unlinkAccount?: MutationCallbacks;
  updateUser?: MutationCallbacks;
};

type SetupOptions = {
  accountInfo?: AccountInfoState;
  accounts?: AccountRecord[];
  auth?: DeepPartial<AuthState>;
  deviceSessions?: SessionRecord[];
  passkeys?: PasskeyRecord[];
  pending?: HookPendingState;
  providerIcons?: Record<string, (props: SVGProps<SVGSVGElement>) => ReactNode>;
  session?: SessionRecord | null;
  sessions?: SessionRecord["session"][];
  username?: UsernameState;
};

type SetupBetterAuthUiMocksResult = {
  accountInfo: MockFunction;
  accounts: AccountRecord[];
  addPasskey: MockFunction;
  auth: AuthState;
  authenticate: MockFunction;
  captured: CapturedOptions;
  changeEmail: MockFunction;
  changePassword: MockFunction;
  checkUsernameAvailability: MockFunction;
  deletePasskey: MockFunction;
  deleteUser: MockFunction;
  deviceSessions: SessionRecord[];
  fileToBase64: MockFunction;
  linkSocial: MockFunction;
  requestPasswordReset: MockFunction;
  resetPassword: MockFunction;
  resetUsernameAvailability: MockFunction;
  revokeMultiSession: MockFunction;
  revokeSession: MockFunction;
  sendVerificationEmail: MockFunction;
  session: SessionRecord | null;
  sessions: SessionRecord["session"][];
  setActiveSession: MockFunction;
  signInEmail: MockFunction;
  signInMagicLink: MockFunction;
  signInPasskey: MockFunction;
  signInSocial: MockFunction;
  signInUsername: MockFunction;
  signOut: MockFunction;
  signUpEmail: MockFunction;
  unlinkAccount: MockFunction;
  updateUser: MockFunction;
};

function createLink({ children, href, ...props }: ComponentProps<"a">) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

export function createMockSession(
  overrides: {
    session?: Partial<SessionRecord["session"]>;
    user?: Partial<AuthUser>;
  } = {},
): SessionRecord {
  return {
    session: {
      createdAt:
        overrides.session?.createdAt ?? new Date("2026-04-18T12:00:00.000Z"),
      expiresAt:
        overrides.session?.expiresAt ?? new Date("2026-05-18T12:00:00.000Z"),
      id: overrides.session?.id ?? "session-1",
      ipAddress: overrides.session?.ipAddress ?? "127.0.0.1",
      token: overrides.session?.token ?? "session-token-1",
      updatedAt:
        overrides.session?.updatedAt ?? new Date("2026-04-18T12:00:00.000Z"),
      userId: overrides.session?.userId ?? "user-1",
      userAgent:
        overrides.session?.userAgent ??
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/122.0.0.0",
    },
    user: {
      createdAt:
        overrides.user?.createdAt ?? new Date("2026-04-18T12:00:00.000Z"),
      displayUsername: overrides.user?.displayUsername ?? "openkitten",
      email: overrides.user?.email ?? "kitten@openkitten.dev",
      emailVerified: overrides.user?.emailVerified ?? true,
      id: overrides.user?.id ?? "user-1",
      image: overrides.user?.image ?? null,
      name: overrides.user?.name ?? "Open Kitten",
      updatedAt:
        overrides.user?.updatedAt ?? new Date("2026-04-18T12:00:00.000Z"),
      username: overrides.user?.username ?? "openkitten",
    },
  };
}

export function createMockAccount(
  overrides: Partial<AccountRecord> = {},
): AccountRecord {
  return {
    accountId: overrides.accountId ?? "account-1",
    createdAt: overrides.createdAt ?? new Date("2026-04-18T12:00:00.000Z"),
    id: overrides.id ?? "account-1",
    providerId: overrides.providerId ?? "github",
    updatedAt: overrides.updatedAt ?? new Date("2026-04-18T12:00:00.000Z"),
    userId: overrides.userId ?? "user-1",
  };
}

export function createMockPasskey(
  overrides: Partial<PasskeyRecord> = {},
): PasskeyRecord {
  return {
    createdAt: overrides.createdAt ?? new Date("2026-04-17T12:00:00.000Z"),
    id: overrides.id ?? "passkey-1",
    name: overrides.name ?? "MacBook Pro",
  };
}

function createLocalization() {
  return {
    auth: {
      account: "Account",
      addAccount: "Add account",
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
      newPassword: "New password",
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
      signOut: "Sign out",
      signUp: "Sign up",
      switchAccount: "Switch account",
      username: "Username",
      usernameOrEmailPlaceholder: "Username or email",
      usernamePlaceholder: "openkitten",
      usernameTaken: "Username is already taken",
      verificationEmailSent: "Verification email sent",
      verifyYourEmail: "Verify your email",
    },
    settings: {
      account: "Account",
      accountUnlinked: "Account unlinked",
      activeSessions: "Active sessions",
      addPasskey: "Add passkey",
      appearance: "Appearance",
      avatar: "Avatar",
      avatarChangedSuccess: "Avatar updated",
      avatarDeletedSuccess: "Avatar removed",
      cancel: "Cancel",
      changeAvatar: "Change avatar",
      changeEmail: "Change email",
      changeEmailSuccess: "Verification email sent to the new address",
      changePassword: "Change password",
      changePasswordSuccess: "Password changed successfully",
      currentPassword: "Current password",
      currentPasswordPlaceholder: "Enter your current password",
      currentSession: "Current session",
      dangerZone: "Danger zone",
      dark: "Dark",
      delete: "Delete",
      deleteAvatar: "Delete avatar",
      deleteUser: "Delete account",
      deleteUserDescription: "Permanently remove your account and all data.",
      deleteUserSuccess: "Account deleted",
      deleteUserVerificationSent: "Check your email to confirm deletion",
      light: "Light",
      link: "Link",
      linkedAccounts: "Linked accounts",
      linkProvider: "Link {{provider}}",
      manageAccounts: "Manage accounts",
      passkeys: "Passkeys",
      passkeysDescription: "Use passkeys to sign in without a password.",
      passkeysInstructions:
        "Create a passkey on this device to keep signing in quickly.",
      profile: "Profile",
      profileUpdatedSuccess: "Profile updated",
      revoke: "Revoke",
      revokeSession: "Revoke session",
      revokeSessionSuccess: "Session revoked",
      saveChanges: "Save changes",
      security: "Security",
      setPassword: "Set password",
      setPasswordDescription:
        "Send yourself a password reset email to create one.",
      settings: "Settings",
      system: "System",
      theme: "Theme",
      unlinkProvider: "Unlink {{provider}}",
      updateEmail: "Update email",
      updatePassword: "Update password",
      uploadAvatar: "Upload avatar",
    },
  };
}

function createAuthState(overrides: DeepPartial<AuthState> = {}): AuthState {
  const defaultLocalization = createLocalization();
  const navigate =
    typeof overrides.navigate === "function" ? overrides.navigate : vi.fn();
  const setTheme =
    overrides.appearance && "setTheme" in overrides.appearance
      ? overrides.appearance.setTheme
      : vi.fn();
  const resize =
    overrides.avatar && "resize" in overrides.avatar
      ? overrides.avatar.resize
      : vi.fn(async (file) => file);
  const upload =
    overrides.avatar && "upload" in overrides.avatar
      ? overrides.avatar.upload
      : vi.fn(async () => "data:image/webp;base64,openkitten");
  const deleteAvatar =
    overrides.avatar && "delete" in overrides.avatar
      ? overrides.avatar.delete
      : vi.fn(async () => undefined);

  return {
    Link: overrides.Link ?? createLink,
    appearance: {
      setTheme,
      theme: overrides.appearance?.theme ?? "system",
      themes: overrides.appearance?.themes ?? ["system", "light", "dark"],
    },
    avatar: {
      delete: deleteAvatar,
      extension: overrides.avatar?.extension ?? "webp",
      resize,
      size: overrides.avatar?.size ?? 256,
      upload,
    },
    basePaths: {
      auth: overrides.basePaths?.auth ?? "/auth",
      settings: overrides.basePaths?.settings ?? "/settings",
    },
    baseURL: overrides.baseURL ?? "https://world.openkitten.dev",
    deleteUser: {
      enabled: overrides.deleteUser?.enabled ?? true,
      sendDeleteAccountVerification:
        overrides.deleteUser?.sendDeleteAccountVerification ?? false,
    },
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
    localization: {
      auth: {
        ...defaultLocalization.auth,
        ...overrides.localization?.auth,
      },
      settings: {
        ...defaultLocalization.settings,
        ...overrides.localization?.settings,
      },
    },
    magicLink: overrides.magicLink ?? true,
    multiSession: overrides.multiSession ?? true,
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
      settings: {
        account: overrides.viewPaths?.settings?.account ?? "account",
        security: overrides.viewPaths?.settings?.security ?? "security",
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
  const session =
    options.session === undefined ? createMockSession() : options.session;
  const accounts = options.accounts ?? [
    createMockAccount({
      accountId: "credential-account",
      id: "credential-account",
      providerId: "credential",
    }),
    createMockAccount(),
  ];
  const deviceSessions = options.deviceSessions ?? [
    createMockSession(),
    createMockSession({
      session: {
        id: "session-2",
        token: "session-token-2",
      },
      user: {
        displayUsername: "otherkitten",
        email: "other@openkitten.dev",
        name: "Other Kitten",
        username: "otherkitten",
      },
    }),
  ];
  const sessions =
    options.sessions ?? deviceSessions.map((item) => item.session);

  const captured: CapturedOptions = {};

  const authenticate = vi.fn();
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
  const changeEmail = vi.fn();
  const changePassword = vi.fn();
  const updateUser = vi.fn();
  const listAccounts = vi.fn();
  const listDeviceSessions = vi.fn();
  const listSessions = vi.fn();
  const listUserPasskeys = vi.fn();
  const accountInfo = vi.fn();
  const linkSocial = vi.fn();
  const unlinkAccount = vi.fn();
  const addPasskey = vi.fn();
  const deletePasskey = vi.fn();
  const deleteUser = vi.fn();
  const revokeSession = vi.fn();
  const revokeMultiSession = vi.fn();
  const setActiveSession = vi.fn();
  const fileToBase64 = vi.fn(async () => "data:image/webp;base64,openkitten");

  vi.doMock("@better-auth-ui/react", () => ({
    ThemePreviewDark: ({ className }: { className?: string }) => (
      <div className={className} data-testid="theme-preview-dark" />
    ),
    ThemePreviewLight: ({ className }: { className?: string }) => (
      <div className={className} data-testid="theme-preview-light" />
    ),
    ThemePreviewSystem: ({ className }: { className?: string }) => (
      <div className={className} data-testid="theme-preview-system" />
    ),
    providerIcons,
    useAccountInfo: (
      accountId: string | undefined,
      config?: CapturedOptions["accountInfo"],
    ) => {
      captured.accountInfo = config;
      accountInfo(accountId);

      return {
        data: options.accountInfo,
        isPending: options.pending?.accountInfo ?? false,
      };
    },
    useAddPasskey: (config: CapturedOptions["addPasskey"]) => {
      captured.addPasskey = config;

      return {
        mutate: addPasskey,
        isPending: options.pending?.addPasskey ?? false,
      };
    },
    useAuth: () => auth,
    useAuthenticate: () => authenticate(),
    useChangeEmail: (config: CapturedOptions["changeEmail"]) => {
      captured.changeEmail = config;

      return {
        mutate: changeEmail,
        isPending: options.pending?.changeEmail ?? false,
      };
    },
    useChangePassword: (config: CapturedOptions["changePassword"]) => {
      captured.changePassword = config;

      return {
        mutate: changePassword,
        isPending: options.pending?.changePassword ?? false,
      };
    },
    useDeletePasskey: (config: CapturedOptions["deletePasskey"]) => {
      captured.deletePasskey = config;

      return {
        mutate: deletePasskey,
        isPending: options.pending?.deletePasskey ?? false,
      };
    },
    useDeleteUser: (config: CapturedOptions["deleteUser"]) => {
      captured.deleteUser = config;

      return {
        mutate: deleteUser,
        isPending: options.pending?.deleteUser ?? false,
      };
    },
    useIsUsernameAvailable: () => ({
      data: options.username?.data,
      error: options.username?.error,
      mutate: checkUsernameAvailability,
      reset: resetUsernameAvailability,
    }),
    useLinkSocial: (config: CapturedOptions["linkSocial"]) => {
      captured.linkSocial = config;

      return {
        mutate: linkSocial,
        isPending: options.pending?.linkSocial ?? false,
      };
    },
    useListAccounts: (config?: CapturedOptions["listAccounts"]) => {
      captured.listAccounts = config;
      listAccounts(config);

      return {
        data: accounts,
        isPending: options.pending?.listAccounts ?? false,
      };
    },
    useListDeviceSessions: (config?: CapturedOptions["listDeviceSessions"]) => {
      captured.listDeviceSessions = config;
      listDeviceSessions(config);

      return {
        data: deviceSessions,
        isPending: options.pending?.listDeviceSessions ?? false,
      };
    },
    useListSessions: (config?: CapturedOptions["listSessions"]) => {
      captured.listSessions = config;
      listSessions(config);

      return {
        data: sessions,
        isPending: options.pending?.listSessions ?? false,
      };
    },
    useListUserPasskeys: (config?: CapturedOptions["listUserPasskeys"]) => {
      captured.listUserPasskeys = config;
      listUserPasskeys(config);

      return {
        data: options.passkeys ?? [createMockPasskey()],
        isPending: options.pending?.listUserPasskeys ?? false,
      };
    },
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
    useRevokeMultiSession: (config: CapturedOptions["revokeMultiSession"]) => {
      captured.revokeMultiSession = config;

      return {
        mutate: revokeMultiSession,
        isPending: options.pending?.revokeMultiSession ?? false,
      };
    },
    useRevokeSession: (config: CapturedOptions["revokeSession"]) => {
      captured.revokeSession = config;

      return {
        mutate: revokeSession,
        isPending: options.pending?.revokeSession ?? false,
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
    useSession: () => ({
      data: session,
      isPending: options.pending?.session ?? false,
    }),
    useSetActiveSession: (config: CapturedOptions["setActiveSession"]) => {
      captured.setActiveSession = config;

      return {
        mutate: setActiveSession,
        isPending: options.pending?.setActiveSession ?? false,
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
    useUnlinkAccount: (config: CapturedOptions["unlinkAccount"]) => {
      captured.unlinkAccount = config;

      return {
        mutate: unlinkAccount,
        isPending: options.pending?.unlinkAccount ?? false,
      };
    },
    useUpdateUser: (config: CapturedOptions["updateUser"]) => {
      captured.updateUser = config;

      return {
        mutate: updateUser,
        isPending: options.pending?.updateUser ?? false,
      };
    },
  }));

  vi.doMock("@better-auth-ui/react/core", () => ({
    fileToBase64,
    getProviderName: (provider: string) =>
      provider
        .split(/[-_]/u)
        .map(
          (segment) => `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`,
        )
        .join(" "),
  }));

  return {
    accountInfo,
    accounts,
    addPasskey,
    auth,
    authenticate,
    captured,
    changeEmail,
    changePassword,
    checkUsernameAvailability,
    deletePasskey,
    deleteUser,
    deviceSessions,
    fileToBase64,
    linkSocial,
    requestPasswordReset,
    resetPassword,
    resetUsernameAvailability,
    revokeMultiSession,
    revokeSession,
    sendVerificationEmail,
    session,
    sessions,
    setActiveSession,
    signInEmail,
    signInMagicLink,
    signInPasskey,
    signInSocial,
    signInUsername,
    signOut,
    signUpEmail,
    unlinkAccount,
    updateUser,
  };
}
