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

test("renders a loading skeleton while sessions are loading", async () => {
  setupBetterAuthUiMocks({
    pending: {
      listSessions: true,
    },
  });
  const { ActiveSessions } = await import(
    "~/components/settings/security/active-sessions"
  );

  render(<ActiveSessions />);

  expect(screen.getByText("Active sessions")).toBeInTheDocument();
  expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBe(3);
});

test("sorts the current session first before rendering rows", async () => {
  const current = createMockSession();
  const other = createMockSession({
    session: { id: "session-2", token: "session-token-2" },
  });

  setupBetterAuthUiMocks({
    session: current,
    sessions: [other.session, current.session],
  });
  vi.doMock("~/components/settings/security/active-session", () => ({
    ActiveSession: ({ activeSession }: { activeSession: { id: string } }) => (
      <div data-testid="active-session-row">{activeSession.id}</div>
    ),
  }));
  const { ActiveSessions } = await import(
    "~/components/settings/security/active-sessions"
  );

  render(<ActiveSessions />);

  const rows = screen.getAllByTestId("active-session-row");

  expect(rows[0]).toHaveTextContent("session-1");
  expect(rows[1]).toHaveTextContent("session-2");
});

test("forwards list errors to toast and returns false", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    sessions: [],
  });
  const { ActiveSessions } = await import(
    "~/components/settings/security/active-sessions"
  );

  render(<ActiveSessions />);

  expect(
    mocks.captured.listSessions?.throwOnError?.({
      error: { message: "Unable to load active sessions" },
    }),
  ).toBe(false);
  expect(
    mocks.captured.listSessions?.throwOnError?.({
      message: "Ignored",
    }),
  ).toBe(false);
  expect(toast.toastError).toHaveBeenCalledWith(
    "Unable to load active sessions",
  );
});

test("keeps session order stable when there is no current session", async () => {
  const first = createMockSession().session;
  const second = createMockSession({
    session: { id: "session-2", token: "session-token-2" },
  }).session;

  setupBetterAuthUiMocks({
    session: null,
    sessions: [first, second],
  });
  vi.doMock("~/components/settings/security/active-session", () => ({
    ActiveSession: ({ activeSession }: { activeSession: { id: string } }) => (
      <div data-testid="active-session-row">{activeSession.id}</div>
    ),
  }));
  const { ActiveSessions } = await import(
    "~/components/settings/security/active-sessions"
  );

  render(<ActiveSessions />);

  const rows = screen.getAllByTestId("active-session-row");

  expect(rows[0]).toHaveTextContent("session-1");
  expect(rows[1]).toHaveTextContent("session-2");
});

test("renders an empty list when the sessions query resolves to undefined", async () => {
  vi.doMock("@better-auth-ui/react", () => ({
    useAuth: () => ({
      localization: {
        settings: {
          activeSessions: "Active sessions",
        },
      },
    }),
    useListSessions: () => ({
      data: undefined,
      isPending: false,
    }),
    useSession: () => ({
      data: createMockSession(),
    }),
  }));
  vi.doMock("~/components/settings/security/active-session", () => ({
    ActiveSession: () => <div data-testid="active-session-row" />,
  }));
  const { ActiveSessions } = await import(
    "~/components/settings/security/active-sessions"
  );

  render(<ActiveSessions />);

  expect(screen.queryByTestId("active-session-row")).toBeNull();
});
