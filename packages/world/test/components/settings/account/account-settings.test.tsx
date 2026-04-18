import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { setupBetterAuthUiMocks } from "~/test/components/auth/mock-better-auth-ui";

function mockAccountChildren() {
  vi.doMock("~/components/settings/account/appearance", () => ({
    Appearance: () => <div data-testid="appearance" />,
  }));
  vi.doMock("~/components/settings/account/change-email", () => ({
    ChangeEmail: () => <div data-testid="change-email" />,
  }));
  vi.doMock("~/components/settings/account/manage-accounts", () => ({
    ManageAccounts: () => <div data-testid="manage-accounts" />,
  }));
  vi.doMock("~/components/settings/account/user-profile", () => ({
    UserProfile: () => <div data-testid="user-profile" />,
  }));
}

beforeEach(() => {
  vi.resetModules();
});

test("renders all enabled account settings sections", async () => {
  setupBetterAuthUiMocks();
  mockAccountChildren();
  const { AccountSettings } = await import(
    "~/components/settings/account/account-settings"
  );

  render(<AccountSettings className="account-settings" data-testid="panel" />);

  expect(screen.getByTestId("panel")).toHaveClass("account-settings");
  expect(screen.getByTestId("user-profile")).toBeInTheDocument();
  expect(screen.getByTestId("change-email")).toBeInTheDocument();
  expect(screen.getByTestId("appearance")).toBeInTheDocument();
  expect(screen.getByTestId("manage-accounts")).toBeInTheDocument();
});

test("hides optional sections when features are disabled", async () => {
  setupBetterAuthUiMocks({
    auth: {
      appearance: {
        setTheme: undefined,
        theme: "system",
        themes: ["system"],
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
      magicLink: false,
      multiSession: false,
    },
  });
  mockAccountChildren();
  const { AccountSettings } = await import(
    "~/components/settings/account/account-settings"
  );

  render(<AccountSettings />);

  expect(screen.getByTestId("user-profile")).toBeInTheDocument();
  expect(screen.queryByTestId("change-email")).toBeNull();
  expect(screen.queryByTestId("appearance")).toBeNull();
  expect(screen.queryByTestId("manage-accounts")).toBeNull();
});
