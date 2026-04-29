import type { ComponentProps, ReactNode, SVGProps } from "react";

import { vi } from "vitest";

type MockFunction = ReturnType<typeof vi.fn>;

type AuthState = {
  Link: (props: ComponentProps<"a">) => ReactNode;
  appearance: {
    setTheme?: ((theme: string) => void) | null;
    theme?: string | null;
    themes: string[];
  };
  avatar: {
    delete?: MockFunction | null;
    extension: string;
    resize?: MockFunction | null;
    size: number;
    upload?: MockFunction | null;
  };
  basePaths: {
    auth: string;
    settings: string;
  };
  baseURL: string;
  deleteUser?: {
    enabled: boolean;
    sendDeleteAccountVerification?: boolean;
  } | null;
  emailAndPassword?: {
    confirmPassword: boolean;
    enabled: boolean;
    forgotPassword: boolean;
    maxPasswordLength: number;
    minPasswordLength: number;
    rememberMe: boolean;
    requireEmailVerification: boolean;
  } | null;
  localization: {
    auth: Record<string, string>;
    settings: Record<string, string>;
  };
  magicLink: boolean;
  multiSession: boolean;
  navigate: MockFunction;
  passkey: boolean;
  redirectTo: string;
  socialProviders: string[] | undefined;
  username: {
    displayUsername: boolean;
    enabled: boolean;
    isUsernameAvailable: boolean;
    maxUsernameLength: number;
    minUsernameLength: number;
  };
  viewPaths: {
    auth: Record<string, string>;
    settings: Record<string, string>;
  };
};

export type CapturedHandlers = {
  changeEmail?: { onSuccess?: () => void };
  changePassword?: {
    onError?: (error: {
      error?: { message?: string };
      message?: string;
    }) => void;
    onSuccess?: () => void;
  };
  requestPasswordReset?: { onSuccess?: () => void };
  revokeMultiSession?: { onSuccess?: () => void };
  revokeSession?: { onSuccess?: () => void };
  unlinkAccount?: { onSuccess?: () => void };
  updateUserAvatar?: { onSuccess?: () => void };
  updateUserProfile?: { onSuccess?: () => void };
};

type SessionUser = {
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

type SessionShape = {
  createdAt: Date;
  expiresAt: Date;
  id: string;
  ipAddress?: string | null;
  token: string;
  updatedAt: Date;
  userAgent?: string | null;
  userId: string;
};

export type SessionData = {
  session: SessionShape;
  user: SessionUser;
};

type DeviceSessionData = SessionData;

type AccountData = {
  accountId: string;
  createdAt: Date;
  id: string;
  providerId: string;
  updatedAt: Date;
  userId: string;
};

type SessionRow = {
  id: string;
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt?: Date;
};

type PasskeyData = { id: string; name?: string | null; createdAt: Date };

type AccountInfoData = {
  data?: {
    login?: string;
    username?: string;
  };
  user?: {
    email?: string;
    name?: string;
  };
} | null;

type Pending = Partial<
  Record<
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
    | "loadingInfo"
    | "requestPasswordReset"
    | "revokeMultiSession"
    | "revokeSession"
    | "session"
    | "setActiveSession"
    | "unlinkAccount"
    | "updateUser",
    boolean
  >
>;

export type SetupSettingsMocksOptions = {
  accountInfo?: AccountInfoData;
  accounts?: AccountData[] | null;
  auth?: Partial<AuthState>;
  deviceSessions?: DeviceSessionData[] | null;
  passkeys?: PasskeyData[] | null;
  pending?: Pending;
  providerIcons?: Record<string, (props: SVGProps<SVGSVGElement>) => ReactNode>;
  session?: SessionData | null;
  sessions?: SessionRow[] | null;
  username?: {
    data?: { available: boolean };
    error?: { error?: { message?: string }; message?: string };
  };
};

export type SettingsMocksResult = {
  addPasskey: MockFunction;
  auth: AuthState;
  captured: CapturedHandlers;
  changeEmail: MockFunction;
  changePassword: MockFunction;
  deletePasskey: MockFunction;
  deleteUser: MockFunction;
  isUsernameAvailable: MockFunction;
  linkSocial: MockFunction;
  resetUsername: MockFunction;
  requestPasswordReset: MockFunction;
  revokeMultiSession: MockFunction;
  revokeSession: MockFunction;
  setActiveSession: MockFunction;
  unlinkAccount: MockFunction;
  updateUser: MockFunction;
  useAuthenticate: MockFunction;
};

function createLink({ children, href, ...props }: ComponentProps<"a">) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

function createAuthState(overrides: Partial<AuthState> = {}): AuthState {
  return {
    Link: overrides.Link ?? createLink,
    appearance: {
      setTheme:
        "setTheme" in (overrides.appearance ?? {})
          ? overrides.appearance?.setTheme
          : vi.fn(),
      theme:
        "theme" in (overrides.appearance ?? {})
          ? overrides.appearance?.theme
          : "system",
      themes: overrides.appearance?.themes ?? ["system", "light", "dark"],
    },
    avatar: {
      delete:
        "delete" in (overrides.avatar ?? {})
          ? overrides.avatar?.delete
          : vi.fn(),
      extension: overrides.avatar?.extension ?? "png",
      resize:
        "resize" in (overrides.avatar ?? {})
          ? overrides.avatar?.resize
          : vi.fn(),
      size: overrides.avatar?.size ?? 256,
      upload:
        "upload" in (overrides.avatar ?? {})
          ? overrides.avatar?.upload
          : vi.fn(),
    },
    basePaths: {
      auth: overrides.basePaths?.auth ?? "/auth",
      settings: overrides.basePaths?.settings ?? "/settings",
    },
    baseURL: overrides.baseURL ?? "https://world.openkitten.dev",
    deleteUser:
      "deleteUser" in overrides
        ? overrides.deleteUser
        : { enabled: true, sendDeleteAccountVerification: false },
    emailAndPassword:
      "emailAndPassword" in overrides
        ? overrides.emailAndPassword
        : {
            confirmPassword: true,
            enabled: true,
            forgotPassword: true,
            maxPasswordLength: 64,
            minPasswordLength: 8,
            rememberMe: true,
            requireEmailVerification: false,
          },
    localization: overrides.localization ?? {
      auth: {
        addAccount: "Add account",
        account: "Account",
        confirmPassword: "Confirm password",
        confirmPasswordPlaceholder: "Confirm your password",
        email: "Email",
        emailPlaceholder: "hello@openkitten.dev",
        hidePassword: "Hide password",
        name: "Name",
        newPassword: "New password",
        newPasswordPlaceholder: "Choose a new password",
        passkey: "Passkey",
        password: "Password",
        passwordPlaceholder: "Enter your password",
        passwordResetEmailSent: "Password reset email sent",
        passwordsDoNotMatch: "Passwords do not match",
        sendResetLink: "Send reset link",
        showPassword: "Show password",
        signIn: "Sign in",
        signOut: "Sign out",
        signUp: "Sign up",
        switchAccount: "Switch account",
        username: "Username",
        usernamePlaceholder: "openkitten",
        usernameTaken: "Username is already taken",
      },
      settings: {
        account: "Account",
        accountUnlinked: "Account unlinked",
        activeSessions: "Active sessions",
        addPasskey: "Add passkey",
        appearance: "Appearance",
        avatar: "Avatar",
        avatarChangedSuccess: "Avatar updated",
        avatarDeletedSuccess: "Avatar deleted",
        cancel: "Cancel",
        changeAvatar: "Change avatar",
        changeEmail: "Change email",
        changeEmailSuccess: "Email changed",
        changePassword: "Change password",
        changePasswordSuccess: "Password changed",
        currentPassword: "Current password",
        currentPasswordPlaceholder: "Enter your current password",
        currentSession: "Current session",
        dangerZone: "Danger zone",
        dark: "Dark",
        delete: "Delete",
        deleteAvatar: "Delete avatar",
        deleteUser: "Delete account",
        deleteUserDescription: "This is permanent",
        deleteUserSuccess: "Account deleted",
        deleteUserVerificationSent: "Verification email sent",
        link: "Link",
        linkProvider: "Link {{provider}}",
        linkedAccounts: "Linked accounts",
        light: "Light",
        manageAccounts: "Manage accounts",
        passkeys: "Passkeys",
        passkeysDescription: "Manage your passkeys",
        passkeysInstructions: "Add a passkey for faster sign-in",
        profile: "Profile",
        profileUpdatedSuccess: "Profile updated",
        revoke: "Revoke",
        revokeSession: "Revoke session",
        revokeSessionSuccess: "Session revoked",
        saveChanges: "Save changes",
        security: "Security",
        setPassword: "Set a password",
        setPasswordDescription: "Send a reset email to set up a password",
        settings: "Settings",
        system: "System",
        theme: "Theme",
        unlinkProvider: "Unlink {{provider}}",
        updateEmail: "Update email",
        updatePassword: "Update password",
        uploadAvatar: "Upload avatar",
      },
    },
    magicLink: overrides.magicLink ?? true,
    multiSession: overrides.multiSession ?? true,
    navigate: overrides.navigate ?? vi.fn(),
    passkey: overrides.passkey ?? true,
    redirectTo: overrides.redirectTo ?? "/play",
    socialProviders:
      "socialProviders" in overrides
        ? overrides.socialProviders
        : ["github", "google"],
    username: {
      displayUsername: overrides.username?.displayUsername ?? false,
      enabled: overrides.username?.enabled ?? true,
      isUsernameAvailable: overrides.username?.isUsernameAvailable ?? true,
      maxUsernameLength: overrides.username?.maxUsernameLength ?? 20,
      minUsernameLength: overrides.username?.minUsernameLength ?? 3,
    },
    viewPaths: overrides.viewPaths ?? {
      auth: {
        forgotPassword: "forgot-password",
        magicLink: "magic-link",
        resetPassword: "reset-password",
        signIn: "sign-in",
        signOut: "sign-out",
        signUp: "sign-up",
      },
      settings: {
        account: "account",
        security: "security",
      },
    },
  };
}

const defaultDate = new Date("2026-01-01T00:00:00Z");

export const defaultSession: SessionData = {
  session: {
    createdAt: defaultDate,
    expiresAt: defaultDate,
    id: "session-1",
    token: "session-token-1",
    updatedAt: defaultDate,
    userId: "user-1",
  },
  user: {
    createdAt: defaultDate,
    displayUsername: null,
    email: "user-1@openkitten.dev",
    emailVerified: true,
    id: "user-1",
    image: null,
    name: "Open Kitten",
    updatedAt: defaultDate,
    username: null,
  },
};

export const defaultAccount: AccountData = {
  accountId: "account-1",
  createdAt: defaultDate,
  id: "account-1",
  providerId: "github",
  updatedAt: defaultDate,
  userId: "user-1",
};

export function setupSettingsMocks(
  options: SetupSettingsMocksOptions = {},
): SettingsMocksResult {
  const auth = createAuthState(options.auth);
  const captured: CapturedHandlers = {};

  const addPasskey = vi.fn();
  const changeEmail = vi.fn();
  const changePassword = vi.fn();
  const deletePasskey = vi.fn();
  const deleteUser = vi.fn();
  const isUsernameAvailable = vi.fn();
  const linkSocial = vi.fn();
  const resetUsername = vi.fn();
  const requestPasswordReset = vi.fn();
  const revokeMultiSession = vi.fn();
  const revokeSession = vi.fn();
  const setActiveSession = vi.fn();
  const unlinkAccount = vi.fn();
  const updateUser = vi.fn();
  const useAuthenticate = vi.fn();

  const session = "session" in options ? options.session : defaultSession;
  const sessions = "sessions" in options ? options.sessions : [];
  const accounts = "accounts" in options ? options.accounts : [];
  const deviceSessions =
    "deviceSessions" in options ? options.deviceSessions : [];
  const passkeys = "passkeys" in options ? options.passkeys : [];

  const providerIcons = options.providerIcons ?? {
    github: (props: SVGProps<SVGSVGElement>) => (
      <svg data-testid="provider-icon-github" {...props} />
    ),
    google: (props: SVGProps<SVGSVGElement>) => (
      <svg data-testid="provider-icon-google" {...props} />
    ),
  };

  const ThemePreviewSystem = (props: ComponentProps<"div">) => (
    <div data-testid="theme-preview-system" {...props} />
  );
  const ThemePreviewLight = (props: ComponentProps<"div">) => (
    <div data-testid="theme-preview-light" {...props} />
  );
  const ThemePreviewDark = (props: ComponentProps<"div">) => (
    <div data-testid="theme-preview-dark" {...props} />
  );

  vi.doMock("@better-auth-ui/react", () => ({
    providerIcons,
    ThemePreviewSystem,
    ThemePreviewLight,
    ThemePreviewDark,
    useAuth: () => auth,
    useAuthenticate: (...args: unknown[]) => useAuthenticate(...args),
    useSession: () => ({
      data: session,
      isPending: options.pending?.session ?? false,
    }),
    useUpdateUser: (config?: CapturedHandlers["updateUserAvatar"]) => {
      if (config) {
        if (!captured.updateUserAvatar) {
          captured.updateUserAvatar = config;
        } else {
          captured.updateUserProfile = config;
        }
      }
      return {
        mutate: updateUser,
        isPending: options.pending?.updateUser ?? false,
      };
    },
    useChangeEmail: (config: CapturedHandlers["changeEmail"]) => {
      captured.changeEmail = config;
      return {
        mutate: changeEmail,
        isPending: options.pending?.changeEmail ?? false,
      };
    },
    useChangePassword: (config: CapturedHandlers["changePassword"]) => {
      captured.changePassword = config;
      return {
        mutate: changePassword,
        isPending: options.pending?.changePassword ?? false,
      };
    },
    useRequestPasswordReset: (
      config: CapturedHandlers["requestPasswordReset"],
    ) => {
      captured.requestPasswordReset = config;
      return {
        mutate: requestPasswordReset,
        isPending: options.pending?.requestPasswordReset ?? false,
      };
    },
    useDeleteUser: () => ({
      mutate: deleteUser,
      isPending: options.pending?.deleteUser ?? false,
    }),
    useListAccounts: () => ({
      data: accounts,
      isPending: options.pending?.listAccounts ?? false,
    }),
    useListSessions: () => ({
      data: sessions,
      isPending: options.pending?.listSessions ?? false,
    }),
    useListDeviceSessions: () => ({
      data: deviceSessions,
      isPending: options.pending?.listDeviceSessions ?? false,
    }),
    useListUserPasskeys: () => ({
      data: passkeys,
      isPending: options.pending?.listUserPasskeys ?? false,
    }),
    useAddPasskey: () => ({
      mutate: addPasskey,
      isPending: options.pending?.addPasskey ?? false,
    }),
    useDeletePasskey: () => ({
      mutate: deletePasskey,
      isPending: options.pending?.deletePasskey ?? false,
    }),
    useRevokeSession: (config: CapturedHandlers["revokeSession"]) => {
      captured.revokeSession = config;
      return {
        mutate: revokeSession,
        isPending: options.pending?.revokeSession ?? false,
      };
    },
    useRevokeMultiSession: (config: CapturedHandlers["revokeMultiSession"]) => {
      captured.revokeMultiSession = config;
      return {
        mutate: revokeMultiSession,
        isPending: options.pending?.revokeMultiSession ?? false,
      };
    },
    useSetActiveSession: () => ({
      mutate: setActiveSession,
      isPending: options.pending?.setActiveSession ?? false,
    }),
    useLinkSocial: () => ({
      mutate: linkSocial,
      isPending: options.pending?.linkSocial ?? false,
    }),
    useUnlinkAccount: (config: CapturedHandlers["unlinkAccount"]) => {
      captured.unlinkAccount = config;
      return {
        mutate: unlinkAccount,
        isPending: options.pending?.unlinkAccount ?? false,
      };
    },
    useAccountInfo: () => ({
      data: options.accountInfo ?? null,
      isPending: options.pending?.loadingInfo ?? false,
    }),
    useIsUsernameAvailable: () => ({
      data: options.username?.data,
      error: options.username?.error,
      mutate: isUsernameAvailable,
      reset: resetUsername,
    }),
  }));

  vi.doMock("@better-auth-ui/react/core", () => ({
    fileToBase64: async (file: File) => `base64:${file.name}`,
    getProviderName: (provider: string) =>
      provider
        .split(/[-_]/u)
        .map(
          (segment) => `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`,
        )
        .join(" "),
  }));

  return {
    addPasskey,
    auth,
    captured,
    changeEmail,
    changePassword,
    deletePasskey,
    deleteUser,
    isUsernameAvailable,
    linkSocial,
    resetUsername,
    requestPasswordReset,
    revokeMultiSession,
    revokeSession,
    setActiveSession,
    unlinkAccount,
    updateUser,
    useAuthenticate,
  };
}

type MockFn = ReturnType<typeof vi.fn>;

export function mockSonner(): { toastError: MockFn; toastSuccess: MockFn } {
  const toastError = vi.fn();
  const toastSuccess = vi.fn();
  vi.doMock("sonner", () => ({
    toast: {
      error: toastError,
      success: toastSuccess,
    },
  }));
  return { toastError, toastSuccess };
}

export function mockReactPacer(): { maybeExecute: MockFn } {
  const maybeExecute = vi.fn();
  vi.doMock("@tanstack/react-pacer", () => ({
    useDebouncer: (callback: (value: string) => void) => ({
      maybeExecute: (value: string) => {
        maybeExecute(value);
        callback(value);
      },
    }),
  }));
  return { maybeExecute };
}
