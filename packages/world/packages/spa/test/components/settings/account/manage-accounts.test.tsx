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

function mockManageAccount() {
  vi.doMock("~/components/settings/account/manage-account", () => ({
    ManageAccount: ({
      deviceSession,
      isPending,
    }: {
      deviceSession?: { session?: { id?: string } } | null;
      isPending?: boolean;
    }) => (
      <div
        data-testid={`manage-account-${deviceSession?.session?.id ?? "none"}`}
        data-pending={String(Boolean(isPending))}
      />
    ),
  }));
}

test("renders the current session and other device sessions with separators", async () => {
  mockSonner();
  setupSettingsMocks({
    deviceSessions: [
      defaultSession,
      {
        session: {
          ...defaultSession.session,
          id: "other",
          token: "t-other",
          userId: "u-other",
        },
        user: {
          ...defaultSession.user,
          email: "other@kitten.dev",
          id: "u-other",
        },
      },
    ],
  });
  mockManageAccount();
  const { ManageAccounts } = await import(
    "~/components/settings/account/manage-accounts"
  );

  const { container } = render(<ManageAccounts className="card" />);

  expect(
    screen.getByTestId(`manage-account-${defaultSession.session.id}`),
  ).toBeInTheDocument();
  expect(screen.getByTestId("manage-account-other")).toBeInTheDocument();
  expect(
    container.querySelectorAll("[data-slot='separator']").length,
  ).toBeGreaterThanOrEqual(1);
});

test("renders a placeholder current row when sessions are still loading", async () => {
  mockSonner();
  setupSettingsMocks({
    pending: { listDeviceSessions: true },
  });
  mockManageAccount();
  const { ManageAccounts } = await import(
    "~/components/settings/account/manage-accounts"
  );

  render(<ManageAccounts />);

  expect(screen.getByTestId("manage-account-none")).toHaveAttribute(
    "data-pending",
    "true",
  );
});

test("renders only the current session when device sessions list is empty", async () => {
  mockSonner();
  setupSettingsMocks({ deviceSessions: [] });
  mockManageAccount();
  const { ManageAccounts } = await import(
    "~/components/settings/account/manage-accounts"
  );

  render(<ManageAccounts />);

  expect(
    screen.getByTestId(`manage-account-${defaultSession.session.id}`),
  ).toBeInTheDocument();
});

test("survives a missing device sessions response", async () => {
  mockSonner();
  setupSettingsMocks({ deviceSessions: null });
  mockManageAccount();
  const { ManageAccounts } = await import(
    "~/components/settings/account/manage-accounts"
  );

  render(<ManageAccounts />);

  expect(
    screen.getByTestId(`manage-account-${defaultSession.session.id}`),
  ).toBeInTheDocument();
});
