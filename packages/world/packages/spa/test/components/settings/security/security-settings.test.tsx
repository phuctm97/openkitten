import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  mockSonner,
  setupSettingsMocks,
} from "~/test/components/settings/mock-better-auth-ui-settings";

function mockChildren() {
  vi.doMock("~/components/settings/security/change-password", () => ({
    ChangePassword: () => <div data-testid="change-password" />,
  }));
  vi.doMock("~/components/settings/security/linked-accounts", () => ({
    LinkedAccounts: () => <div data-testid="linked-accounts" />,
  }));
  vi.doMock("~/components/settings/security/passkeys", () => ({
    Passkeys: () => <div data-testid="passkeys" />,
  }));
  vi.doMock("~/components/settings/security/active-sessions", () => ({
    ActiveSessions: () => <div data-testid="active-sessions" />,
  }));
  vi.doMock("~/components/settings/security/danger-zone", () => ({
    DangerZone: () => <div data-testid="danger-zone" />,
  }));
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("renders all sections when fully configured", async () => {
  mockSonner();
  setupSettingsMocks();
  mockChildren();
  const { SecuritySettings } = await import(
    "~/components/settings/security/security-settings"
  );

  render(<SecuritySettings className="grid" />);

  expect(screen.getByTestId("change-password")).toBeInTheDocument();
  expect(screen.getByTestId("linked-accounts")).toBeInTheDocument();
  expect(screen.getByTestId("passkeys")).toBeInTheDocument();
  expect(screen.getByTestId("active-sessions")).toBeInTheDocument();
  expect(screen.getByTestId("danger-zone")).toBeInTheDocument();
});

test("hides optional sections when feature flags are disabled", async () => {
  mockSonner();
  setupSettingsMocks({
    auth: {
      deleteUser: { enabled: false },
      emailAndPassword: null,
      passkey: false,
      socialProviders: [],
    },
  });
  mockChildren();
  const { SecuritySettings } = await import(
    "~/components/settings/security/security-settings"
  );

  render(<SecuritySettings />);

  expect(screen.queryByTestId("change-password")).toBeNull();
  expect(screen.queryByTestId("linked-accounts")).toBeNull();
  expect(screen.queryByTestId("passkeys")).toBeNull();
  expect(screen.getByTestId("active-sessions")).toBeInTheDocument();
  expect(screen.queryByTestId("danger-zone")).toBeNull();
});

test("hides danger zone when deleteUser is null", async () => {
  mockSonner();
  setupSettingsMocks({
    auth: { deleteUser: null },
  });
  mockChildren();
  const { SecuritySettings } = await import(
    "~/components/settings/security/security-settings"
  );

  render(<SecuritySettings />);

  expect(screen.queryByTestId("danger-zone")).toBeNull();
});
