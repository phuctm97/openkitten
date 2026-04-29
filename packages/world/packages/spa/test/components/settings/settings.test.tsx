import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  mockSonner,
  setupSettingsMocks,
} from "~/test/components/settings/mock-better-auth-ui-settings";

function mockSubcomponents() {
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

afterEach(() => {
  vi.unstubAllGlobals();
});

test("activates the account view when an explicit view prop is provided", async () => {
  mockSonner();
  const mocks = setupSettingsMocks({
    auth: {
      viewPaths: {
        auth: { signIn: "sign-in", signOut: "sign-out" },
        settings: { account: "account", security: "security" },
      },
    },
  });
  mockSubcomponents();
  const { Settings } = await import("~/components/settings/settings");

  render(<Settings className="settings-card" view="account" />);

  expect(mocks.useAuthenticate).toHaveBeenCalled();
  expect(screen.getByTestId("account-settings")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Account" })).toHaveAttribute(
    "href",
    "/settings/account",
  );
  expect(screen.getByRole("tab", { name: "Security" })).toHaveAttribute(
    "href",
    "/settings/security",
  );
});

test("resolves view from path and supports hideNav", async () => {
  mockSonner();
  setupSettingsMocks();
  mockSubcomponents();
  const { Settings } = await import("~/components/settings/settings");

  const { container } = render(<Settings path="security" hideNav />);

  expect(screen.getByTestId("security-settings")).toBeInTheDocument();
  const navContainer = container.querySelector(".hidden");
  expect(navContainer).toBeInTheDocument();
});

test("falls back to undefined view when path does not map to a known view", async () => {
  mockSonner();
  setupSettingsMocks();
  mockSubcomponents();
  const { Settings } = await import("~/components/settings/settings");

  render(<Settings path="unknown" />);

  expect(screen.getByRole("tablist", { name: "Settings" })).toBeInTheDocument();
});

test("throws when neither view nor path is provided", async () => {
  mockSonner();
  setupSettingsMocks();
  mockSubcomponents();
  const { Settings } = await import("~/components/settings/settings");

  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  expect(() => render(<Settings />)).toThrow(
    /Either `view` or `path` must be provided/,
  );

  consoleError.mockRestore();
});
