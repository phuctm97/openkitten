import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  createMockSession,
  mockSonnerToast,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

test("navigates to sign-out for the current session", async () => {
  const current = createMockSession();
  const mocks = setupBetterAuthUiMocks({
    session: current,
  });
  const { ActiveSession } = await import(
    "~/components/settings/security/active-session"
  );

  render(<ActiveSession activeSession={current.session} />);

  expect(screen.getByText("Current session")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(mocks.auth.navigate).toHaveBeenCalledWith({ to: "/auth/sign-out" });
});

test("revokes non-current sessions", async () => {
  const toast = mockSonnerToast();
  const current = createMockSession();
  const other = createMockSession({
    session: {
      createdAt: new Date(Date.now() - 60_000),
      id: "session-2",
      token: "session-token-2",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile",
    },
  });
  const mocks = setupBetterAuthUiMocks({
    session: current,
  });
  const { ActiveSession } = await import(
    "~/components/settings/security/active-session"
  );

  render(<ActiveSession activeSession={other.session} />);

  fireEvent.click(screen.getByRole("button", { name: /revoke session/i }));
  expect(mocks.revokeSession).toHaveBeenCalledWith(other.session);
  mocks.captured.revokeSession?.onSuccess?.();
  mocks.captured.revokeSession?.onError?.({
    error: { message: "Unable to revoke" },
  });

  expect(toast.toastSuccess).toHaveBeenCalledWith("Session revoked");
  expect(toast.toastError).toHaveBeenCalledWith("Unable to revoke");
});

test("renders an unknown browser label for a fresh session without user agent details", async () => {
  const current = createMockSession();
  setupBetterAuthUiMocks({
    session: current,
  });
  const { ActiveSession } = await import(
    "~/components/settings/security/active-session"
  );

  render(
    <ActiveSession
      activeSession={
        createMockSession({
          session: {
            createdAt: new Date(),
            id: "session-3",
            token: "session-token-3",
            userAgent: "",
          },
        }).session
      }
    />,
  );

  expect(screen.getByText("Unknown Browser")).toBeInTheDocument();
});

test("shows the revoke spinner while a session revoke is pending", async () => {
  const current = createMockSession();
  const other = createMockSession({
    session: {
      id: "session-4",
      token: "session-token-4",
      userAgent: "Mozilla/5.0",
    },
  });
  setupBetterAuthUiMocks({
    pending: {
      revokeSession: true,
    },
    session: current,
  });
  const { ActiveSession } = await import(
    "~/components/settings/security/active-session"
  );

  render(<ActiveSession activeSession={other.session} />);

  expect(
    screen.getByRole("button", { name: /revoke session/i }),
  ).toBeDisabled();
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});
