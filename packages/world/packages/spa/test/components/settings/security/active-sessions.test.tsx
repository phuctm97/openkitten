import { render, screen } from "@testing-library/react";
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

function mockActiveSession() {
  vi.doMock("~/components/settings/security/active-session", () => ({
    ActiveSession: ({ activeSession }: { activeSession: { id: string } }) => (
      <div data-testid={`active-session-${activeSession.id}`} />
    ),
  }));
}

test("renders the current session first and others after, with separators", async () => {
  mockSonner();
  setupSettingsMocks({
    sessions: [
      { id: "other-1", token: "t1" },
      { id: defaultSession.session.id, token: defaultSession.session.token },
      { id: "other-2", token: "t2" },
    ],
  });
  mockActiveSession();
  const { ActiveSessions } = await import(
    "~/components/settings/security/active-sessions"
  );

  const { container } = render(<ActiveSessions className="card" />);

  expect(
    screen.getByTestId(`active-session-${defaultSession.session.id}`),
  ).toBeInTheDocument();
  expect(screen.getByTestId("active-session-other-1")).toBeInTheDocument();
  expect(screen.getByTestId("active-session-other-2")).toBeInTheDocument();
  expect(
    container.querySelectorAll("[data-slot='separator']").length,
  ).toBeGreaterThan(0);
});

test("renders a skeleton when sessions are loading", async () => {
  mockSonner();
  setupSettingsMocks({ pending: { listSessions: true } });
  mockActiveSession();
  const { ActiveSessions } = await import(
    "~/components/settings/security/active-sessions"
  );

  const { container } = render(<ActiveSessions />);

  expect(
    container.querySelectorAll("[data-slot='skeleton']").length,
  ).toBeGreaterThan(0);
});

test("renders an empty card when there are no sessions", async () => {
  mockSonner();
  setupSettingsMocks({ sessions: null });
  mockActiveSession();
  const { ActiveSessions } = await import(
    "~/components/settings/security/active-sessions"
  );

  render(<ActiveSessions />);

  expect(screen.getByText("Active sessions")).toBeInTheDocument();
});
