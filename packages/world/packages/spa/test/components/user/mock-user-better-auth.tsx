import type { ComponentProps, ReactNode } from "react";

import { vi } from "vitest";

type MockFunction = ReturnType<typeof vi.fn>;

type Appearance = {
  setTheme?: ((theme: string) => void) | null;
  theme?: string | null;
  themes?: string[];
};

type AuthState = {
  Link: (props: ComponentProps<"a">) => ReactNode;
  appearance: Appearance;
  basePaths: { auth: string; settings: string };
  localization: {
    auth: Record<string, string>;
    settings: Record<string, string>;
  };
  multiSession: boolean;
  navigate: MockFunction;
  viewPaths: {
    auth: { signIn: string; signOut: string; signUp: string };
    settings: { account: string; security: string };
  };
};

type SessionUser = {
  displayUsername?: string | null;
  email: string;
  id: string;
  image?: string | null;
  name?: string | null;
  username?: string | null;
};

export type SessionData = {
  session: { id: string; token: string; userId: string };
  user: SessionUser;
};

type DeviceSession = SessionData;

type Pending = {
  session?: boolean;
  setActiveSession?: boolean;
  listDeviceSessions?: boolean;
};

export type SetupMocksOptions = {
  appearance?: Appearance;
  auth?: Partial<AuthState>;
  deviceSessions?: DeviceSession[] | null;
  multiSession?: boolean;
  pending?: Pending;
  session?: SessionData | null;
};

function createLink({ children, href, ...props }: ComponentProps<"a">) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

function createAuthState(options: SetupMocksOptions = {}): AuthState {
  return {
    Link: options.auth?.Link ?? createLink,
    appearance: {
      setTheme:
        "setTheme" in (options.appearance ?? {})
          ? options.appearance?.setTheme
          : vi.fn(),
      theme:
        "theme" in (options.appearance ?? {})
          ? options.appearance?.theme
          : "system",
      themes: options.appearance?.themes ?? ["system", "light", "dark"],
    },
    basePaths: {
      auth: options.auth?.basePaths?.auth ?? "/auth",
      settings: options.auth?.basePaths?.settings ?? "/settings",
    },
    localization: options.auth?.localization ?? {
      auth: {
        account: "Account",
        addAccount: "Add account",
        signIn: "Sign in",
        signOut: "Sign out",
        signUp: "Sign up",
        switchAccount: "Switch account",
      },
      settings: {
        dark: "Dark",
        light: "Light",
        settings: "Settings",
        system: "System",
        theme: "Theme",
      },
    },
    multiSession: options.multiSession ?? options.auth?.multiSession ?? true,
    navigate: options.auth?.navigate ?? vi.fn(),
    viewPaths: options.auth?.viewPaths ?? {
      auth: {
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

export const defaultUserSession: SessionData = {
  session: { id: "s-1", token: "tk", userId: "u-1" },
  user: {
    displayUsername: null,
    email: "user-1@kitten.dev",
    id: "u-1",
    image: null,
    name: "Open Kitten",
    username: null,
  },
};

type UserMocksResult = {
  auth: AuthState;
  session: SessionData | null | undefined;
  setActiveSession: MockFunction;
};

export function setupUserMocks(
  options: SetupMocksOptions = {},
): UserMocksResult {
  const auth = createAuthState(options);
  const session = "session" in options ? options.session : defaultUserSession;
  const deviceSessions =
    "deviceSessions" in options ? options.deviceSessions : [];
  const setActiveSession = vi.fn();

  vi.doMock("@better-auth-ui/react", () => ({
    useAuth: () => auth,
    useSession: () => ({
      data: session,
      isPending: options.pending?.session ?? false,
    }),
    useSetActiveSession: () => ({
      mutate: setActiveSession,
      isPending: options.pending?.setActiveSession ?? false,
    }),
    useListDeviceSessions: () => ({
      data: deviceSessions,
      isPending: options.pending?.listDeviceSessions ?? false,
    }),
  }));

  return {
    auth,
    session,
    setActiveSession,
  };
}

export function mockSonner(): {
  toastError: MockFunction;
  toastSuccess: MockFunction;
} {
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
