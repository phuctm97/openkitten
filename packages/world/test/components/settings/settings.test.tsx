import { render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, expect, test, vi } from "vitest";

import { setupBetterAuthUiMocks } from "~/test/components/auth/mock-better-auth-ui";

function mockTabs() {
  vi.doMock("~/components/ui/tabs", () => ({
    Tabs: ({
      children,
      className,
      value,
    }: {
      children: ReactNode;
      className?: string;
      value?: string;
    }) => (
      <div className={className} data-testid="tabs" data-value={value}>
        {children}
      </div>
    ),
    TabsContent: ({
      children,
      value,
    }: {
      children: ReactNode;
      value: string;
    }) => <div data-testid={`content-${value}`}>{children}</div>,
    TabsList: ({ children, ...props }: ComponentProps<"div">) => (
      <div {...props}>{children}</div>
    ),
    TabsTrigger: ({ children, ...props }: ComponentProps<"div">) => (
      <div {...props}>{children}</div>
    ),
  }));
}

function mockSettingsChildren() {
  vi.doMock("~/components/settings/account/account-settings", () => ({
    AccountSettings: () => <div data-testid="account-settings" />,
  }));
  vi.doMock("~/components/settings/security/security-settings", () => ({
    SecuritySettings: () => <div data-testid="security-settings" />,
  }));
}

beforeEach(() => {
  vi.resetModules();
});

test("throws when neither view nor path is provided", async () => {
  setupBetterAuthUiMocks();
  mockTabs();
  mockSettingsChildren();
  const { Settings } = await import("~/components/settings/settings");

  expect(() => render(<Settings />)).toThrow(
    "[Better Auth UI] Either `view` or `path` must be provided",
  );
});

test("renders the account view and calls useAuthenticate", async () => {
  const mocks = setupBetterAuthUiMocks();
  mockTabs();
  mockSettingsChildren();
  const { Settings } = await import("~/components/settings/settings");

  render(<Settings className="settings-panel" view="account" />);

  expect(mocks.authenticate).toHaveBeenCalled();
  expect(screen.getByTestId("tabs")).toHaveAttribute("data-value", "account");
  expect(screen.getByTestId("tabs")).toHaveClass("settings-panel");
  expect(screen.getByTestId("account-settings")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute(
    "href",
    "/settings/account",
  );
  expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute(
    "href",
    "/settings/security",
  );
});

test("resolves the security view from the current path and hides nav", async () => {
  const mocks = setupBetterAuthUiMocks();
  mockTabs();
  mockSettingsChildren();
  const { Settings } = await import("~/components/settings/settings");

  render(<Settings hideNav path={mocks.auth.viewPaths.settings.security} />);

  expect(screen.getByTestId("tabs")).toHaveAttribute("data-value", "security");
  expect(screen.getByTestId("security-settings")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Account" }).parentElement?.parentElement
      ?.parentElement,
  ).toHaveClass("hidden");
});

test("leaves the tabs value unset when the path does not match a settings view", async () => {
  setupBetterAuthUiMocks();
  mockTabs();
  mockSettingsChildren();
  const { Settings } = await import("~/components/settings/settings");

  render(<Settings path="/settings/unknown" />);

  expect(screen.getByTestId("tabs")).not.toHaveAttribute("data-value");
});
