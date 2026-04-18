import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  createMockSession,
  mockSonnerToast,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

test("shows a pending current row while device sessions are loading", async () => {
  setupBetterAuthUiMocks({
    deviceSessions: [],
    pending: {
      listDeviceSessions: true,
    },
  });
  vi.doMock("~/components/settings/account/manage-account", () => ({
    ManageAccount: ({
      deviceSession,
      isPending,
    }: {
      deviceSession: { session?: { id: string } } | null;
      isPending?: boolean;
    }) => (
      <div
        data-testid="manage-account-row"
        data-pending={String(!!isPending)}
        data-session-id={deviceSession?.session?.id ?? "none"}
      />
    ),
  }));
  const { ManageAccounts } = await import(
    "~/components/settings/account/manage-accounts"
  );

  render(<ManageAccounts />);

  expect(screen.getAllByTestId("manage-account-row")).toHaveLength(1);
  expect(screen.getByTestId("manage-account-row")).toHaveAttribute(
    "data-pending",
    "true",
  );
  expect(screen.getByTestId("manage-account-row")).toHaveAttribute(
    "data-session-id",
    "none",
  );
});

test("renders the current session and each additional device session", async () => {
  const current = createMockSession();
  const other = createMockSession({
    session: { id: "session-2", token: "session-token-2" },
  });

  setupBetterAuthUiMocks({
    deviceSessions: [current, other],
    session: current,
  });
  vi.doMock("~/components/settings/account/manage-account", () => ({
    ManageAccount: ({
      deviceSession,
      isPending,
    }: {
      deviceSession: { session?: { id: string } } | null;
      isPending?: boolean;
    }) => (
      <div
        data-testid={`manage-account-${deviceSession?.session?.id ?? "none"}`}
        data-pending={String(!!isPending)}
      />
    ),
  }));
  const { ManageAccounts } = await import(
    "~/components/settings/account/manage-accounts"
  );

  render(<ManageAccounts />);

  expect(screen.getByTestId("manage-account-session-1")).toBeInTheDocument();
  expect(screen.getByTestId("manage-account-session-2")).toBeInTheDocument();
});

test("forwards list errors to toast and returns false", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    deviceSessions: [],
  });
  vi.doMock("~/components/settings/account/manage-account", () => ({
    ManageAccount: () => <div data-testid="manage-account-row" />,
  }));
  const { ManageAccounts } = await import(
    "~/components/settings/account/manage-accounts"
  );

  render(<ManageAccounts />);

  expect(
    mocks.captured.listDeviceSessions?.throwOnError?.({
      error: { message: "Unable to load sessions" },
    }),
  ).toBe(false);
  expect(
    mocks.captured.listDeviceSessions?.throwOnError?.({
      message: "Ignored",
    }),
  ).toBe(false);
  expect(toast.toastError).toHaveBeenCalledWith("Unable to load sessions");
});

test("keeps all device sessions when there is no active session to filter against", async () => {
  setupBetterAuthUiMocks({
    deviceSessions: [
      createMockSession(),
      createMockSession({
        session: { id: "session-2", token: "session-token-2" },
      }),
    ],
    session: null,
  });
  vi.doMock("~/components/settings/account/manage-account", () => ({
    ManageAccount: ({
      deviceSession,
    }: {
      deviceSession: { session?: { id: string } } | null;
    }) => (
      <div
        data-testid={`manage-account-${deviceSession?.session?.id ?? "none"}`}
      />
    ),
  }));
  const { ManageAccounts } = await import(
    "~/components/settings/account/manage-accounts"
  );

  render(<ManageAccounts />);

  expect(screen.getByTestId("manage-account-session-1")).toBeInTheDocument();
  expect(screen.getByTestId("manage-account-session-2")).toBeInTheDocument();
});

test("renders only the current row when the device session list is undefined", async () => {
  vi.doMock("@better-auth-ui/react", () => ({
    useAuth: () => ({
      localization: {
        settings: {
          manageAccounts: "Manage accounts",
        },
      },
    }),
    useListDeviceSessions: () => ({
      data: undefined,
      isPending: false,
    }),
    useSession: () => ({
      data: createMockSession(),
    }),
  }));
  vi.doMock("~/components/settings/account/manage-account", () => ({
    ManageAccount: ({
      deviceSession,
    }: {
      deviceSession: { session?: { id: string } } | null;
    }) => (
      <div
        data-testid={`manage-account-${deviceSession?.session?.id ?? "none"}`}
      />
    ),
  }));
  const { ManageAccounts } = await import(
    "~/components/settings/account/manage-accounts"
  );

  render(<ManageAccounts />);

  expect(screen.getByTestId("manage-account-session-1")).toBeInTheDocument();
  expect(screen.queryByTestId("manage-account-session-2")).toBeNull();
});
