import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  mockSonner,
  setupSettingsMocks,
} from "~/test/components/settings/mock-better-auth-ui-settings";

function mockChildren() {
  vi.doMock("~/components/settings/account/user-profile", () => ({
    UserProfile: () => <div data-testid="user-profile" />,
  }));
  vi.doMock("~/components/settings/account/change-email", () => ({
    ChangeEmail: () => <div data-testid="change-email" />,
  }));
  vi.doMock("~/components/settings/account/appearance", () => ({
    Appearance: () => <div data-testid="appearance" />,
  }));
  vi.doMock("~/components/settings/account/manage-accounts", () => ({
    ManageAccounts: () => <div data-testid="manage-accounts" />,
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
  const { AccountSettings } = await import(
    "~/components/settings/account/account-settings"
  );

  render(<AccountSettings className="grid" />);

  expect(screen.getByTestId("user-profile")).toBeInTheDocument();
  expect(screen.getByTestId("change-email")).toBeInTheDocument();
  expect(screen.getByTestId("appearance")).toBeInTheDocument();
  expect(screen.getByTestId("manage-accounts")).toBeInTheDocument();
});

test("hides change-email when both emailAndPassword and magicLink are disabled", async () => {
  mockSonner();
  setupSettingsMocks({
    auth: {
      emailAndPassword: null,
      magicLink: false,
    },
  });
  mockChildren();
  const { AccountSettings } = await import(
    "~/components/settings/account/account-settings"
  );

  render(<AccountSettings />);

  expect(screen.queryByTestId("change-email")).toBeNull();
});

test("hides appearance and manage-accounts when not configured", async () => {
  mockSonner();
  setupSettingsMocks({
    auth: {
      appearance: { setTheme: null, theme: "system", themes: ["light"] },
      multiSession: false,
    },
  });
  mockChildren();
  const { AccountSettings } = await import(
    "~/components/settings/account/account-settings"
  );

  render(<AccountSettings />);

  expect(screen.queryByTestId("appearance")).toBeNull();
  expect(screen.queryByTestId("manage-accounts")).toBeNull();
});

test("renders change-email via magic link only", async () => {
  mockSonner();
  setupSettingsMocks({
    auth: {
      emailAndPassword: {
        confirmPassword: true,
        enabled: false,
        forgotPassword: true,
        maxPasswordLength: 64,
        minPasswordLength: 8,
        rememberMe: true,
        requireEmailVerification: false,
      },
      magicLink: true,
    },
  });
  mockChildren();
  const { AccountSettings } = await import(
    "~/components/settings/account/account-settings"
  );

  render(<AccountSettings />);

  expect(screen.getByTestId("change-email")).toBeInTheDocument();
});
