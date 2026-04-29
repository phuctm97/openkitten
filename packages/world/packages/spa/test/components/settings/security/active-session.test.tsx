import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  defaultSession,
  mockSonner,
  setupSettingsMocks,
} from "~/test/components/settings/mock-better-auth-ui-settings";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const desktopUserAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const mobileUserAgent =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test("navigates to sign-out when clicking the current session button", async () => {
  mockSonner();
  const mocks = setupSettingsMocks();
  const { ActiveSession } = await import(
    "~/components/settings/security/active-session"
  );

  render(
    <ActiveSession
      activeSession={{
        ...defaultSession.session,
        id: "session-1",
        token: defaultSession.session.token,
        userAgent: desktopUserAgent,
        createdAt: new Date(),
      }}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /Sign out/u }));
  expect(mocks.auth.navigate).toHaveBeenCalledWith({
    to: "/auth/sign-out",
  });
});

test("revokes other sessions and toasts on success", async () => {
  const sonner = mockSonner();
  const mocks = setupSettingsMocks();
  const { ActiveSession } = await import(
    "~/components/settings/security/active-session"
  );

  const session = {
    ...defaultSession.session,
    id: "session-other",
    token: "other-token",
    userAgent: mobileUserAgent,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  };

  render(<ActiveSession activeSession={session} />);

  fireEvent.click(screen.getByRole("button", { name: "Revoke session" }));
  expect(mocks.revokeSession).toHaveBeenCalledWith(session);

  mocks.captured.revokeSession?.onSuccess?.();
  expect(sonner.toastSuccess).toHaveBeenCalledWith("Session revoked");
});

test("shows the spinner when revoking is pending", async () => {
  mockSonner();
  setupSettingsMocks({ pending: { revokeSession: true } });
  const { ActiveSession } = await import(
    "~/components/settings/security/active-session"
  );

  render(
    <ActiveSession
      activeSession={{
        ...defaultSession.session,
        id: "session-other",
        token: "other-token",
        userAgent: desktopUserAgent,
        createdAt: new Date(Date.now() - 60 * 1000),
      }}
    />,
  );

  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});

test("renders Unknown Browser fallback when bowser cannot identify the browser", async () => {
  mockSonner();
  setupSettingsMocks();
  const { ActiveSession } = await import(
    "~/components/settings/security/active-session"
  );

  render(
    <ActiveSession
      activeSession={{
        ...defaultSession.session,
        id: "session-other",
        token: "other-token",
        userAgent: "WeirdBot/1.0",
      }}
    />,
  );

  expect(screen.getByText("Unknown Browser")).toBeInTheDocument();
});

test("uses an empty user agent fallback when bowser is mocked", async () => {
  mockSonner();
  setupSettingsMocks();
  vi.doMock("bowser", () => ({
    default: {
      parse: () => ({
        browser: { name: undefined },
        os: { name: undefined },
        platform: { type: "tablet" },
      }),
    },
  }));
  const { ActiveSession } = await import(
    "~/components/settings/security/active-session"
  );

  render(
    <ActiveSession
      activeSession={{
        ...defaultSession.session,
        id: "session-no-ua",
        token: "no-ua",
        userAgent: null,
      }}
    />,
  );

  expect(screen.getByText("Unknown Browser")).toBeInTheDocument();
});

test("formats relative time across multiple buckets", async () => {
  mockSonner();
  setupSettingsMocks();
  const { ActiveSession } = await import(
    "~/components/settings/security/active-session"
  );

  const now = Date.now();
  const ages: { key: string; ms: number }[] = [
    { key: "year", ms: 366 * 24 * 60 * 60 * 1000 },
    { key: "month", ms: 31 * 24 * 60 * 60 * 1000 },
    { key: "week", ms: 8 * 24 * 60 * 60 * 1000 },
    { key: "day", ms: 25 * 60 * 60 * 1000 },
    { key: "hour", ms: 2 * 60 * 60 * 1000 },
    { key: "minute", ms: 5 * 60 * 1000 },
    { key: "second", ms: 5 * 1000 },
    { key: "now", ms: 0 },
  ];

  for (const age of ages) {
    render(
      <ActiveSession
        activeSession={{
          ...defaultSession.session,
          id: `s-${age.key}`,
          token: `t-${age.key}`,
          userAgent: desktopUserAgent,
          createdAt: new Date(now - age.ms),
        }}
      />,
    );
  }
});
