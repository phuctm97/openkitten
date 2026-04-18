import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { setupBetterAuthUiMocks } from "~/test/components/auth/mock-better-auth-ui";

function mockSecurityChildren() {
  vi.doMock("~/components/settings/security/active-sessions", () => ({
    ActiveSessions: () => <div data-testid="active-sessions" />,
  }));
  vi.doMock("~/components/settings/security/change-password", () => ({
    ChangePassword: () => <div data-testid="change-password" />,
  }));
  vi.doMock("~/components/settings/security/danger-zone", () => ({
    DangerZone: () => <div data-testid="danger-zone" />,
  }));
  vi.doMock("~/components/settings/security/linked-accounts", () => ({
    LinkedAccounts: () => <div data-testid="linked-accounts" />,
  }));
  vi.doMock("~/components/settings/security/passkeys", () => ({
    Passkeys: () => <div data-testid="passkeys" />,
  }));
}

beforeEach(() => {
  vi.resetModules();
});

test("renders each enabled security section", async () => {
  setupBetterAuthUiMocks();
  mockSecurityChildren();
  const { SecuritySettings } = await import(
    "~/components/settings/security/security-settings"
  );

  render(<SecuritySettings className="security-settings" />);

  expect(screen.getByTestId("change-password")).toBeInTheDocument();
  expect(screen.getByTestId("linked-accounts")).toBeInTheDocument();
  expect(screen.getByTestId("passkeys")).toBeInTheDocument();
  expect(screen.getByTestId("active-sessions")).toBeInTheDocument();
  expect(screen.getByTestId("danger-zone")).toBeInTheDocument();
});

test("keeps only always-on sections when optional features are disabled", async () => {
  setupBetterAuthUiMocks({
    auth: {
      deleteUser: {
        enabled: false,
        sendDeleteAccountVerification: false,
      },
      emailAndPassword: {
        confirmPassword: true,
        enabled: false,
        forgotPassword: false,
        maxPasswordLength: 64,
        minPasswordLength: 8,
        rememberMe: false,
        requireEmailVerification: false,
      },
      passkey: false,
      socialProviders: [],
    },
  });
  mockSecurityChildren();
  const { SecuritySettings } = await import(
    "~/components/settings/security/security-settings"
  );

  render(<SecuritySettings />);

  expect(screen.getByTestId("active-sessions")).toBeInTheDocument();
  expect(screen.queryByTestId("change-password")).toBeNull();
  expect(screen.queryByTestId("linked-accounts")).toBeNull();
  expect(screen.queryByTestId("passkeys")).toBeNull();
  expect(screen.queryByTestId("danger-zone")).toBeNull();
});
