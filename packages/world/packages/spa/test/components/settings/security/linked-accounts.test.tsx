import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  defaultAccount,
  mockSonner,
  setupSettingsMocks,
} from "~/test/components/settings/mock-better-auth-ui-settings";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockLinkedAccount() {
  vi.doMock("~/components/settings/security/linked-account", () => ({
    LinkedAccount: ({
      account,
      provider,
    }: {
      account?: { id?: string };
      provider: string;
    }) => (
      <div
        data-testid={`linked-account-${provider}`}
        data-account-id={account?.id ?? ""}
      />
    ),
  }));
}

test("renders linked accounts and unlinked providers, skipping the credential entry", async () => {
  mockSonner();
  setupSettingsMocks({
    accounts: [
      { ...defaultAccount, id: "a1", accountId: "k", providerId: "credential" },
      { ...defaultAccount, id: "a2", accountId: "g", providerId: "github" },
    ],
    auth: { socialProviders: ["github", "google"] },
  });
  mockLinkedAccount();
  const { LinkedAccounts } = await import(
    "~/components/settings/security/linked-accounts"
  );

  const { container } = render(<LinkedAccounts className="card" />);

  const githubItems = screen.getAllByTestId("linked-account-github");
  expect(githubItems[0]).toHaveAttribute("data-account-id", "a2");
  expect(screen.getByTestId("linked-account-google")).toBeInTheDocument();
  expect(
    container.querySelectorAll("[data-slot='separator']").length,
  ).toBeGreaterThan(0);
});

test("renders skeleton placeholders for each provider while loading", async () => {
  mockSonner();
  setupSettingsMocks({
    accounts: null,
    auth: { socialProviders: ["github", "google"] },
    pending: { listAccounts: true },
  });
  mockLinkedAccount();
  const { LinkedAccounts } = await import(
    "~/components/settings/security/linked-accounts"
  );

  const { container } = render(<LinkedAccounts />);

  expect(
    container.querySelectorAll("[data-slot='skeleton']").length,
  ).toBeGreaterThan(0);
});

test("renders nothing extra when there are no accounts and no providers", async () => {
  mockSonner();
  setupSettingsMocks({
    accounts: null,
    auth: { socialProviders: [] },
  });
  mockLinkedAccount();
  const { LinkedAccounts } = await import(
    "~/components/settings/security/linked-accounts"
  );

  render(<LinkedAccounts />);

  expect(screen.getByText("Linked accounts")).toBeInTheDocument();
});

test("falls back to an empty list when socialProviders is undefined", async () => {
  mockSonner();
  setupSettingsMocks({
    accounts: null,
    auth: { socialProviders: undefined },
  });
  mockLinkedAccount();
  const { LinkedAccounts } = await import(
    "~/components/settings/security/linked-accounts"
  );

  render(<LinkedAccounts />);

  expect(screen.getByText("Linked accounts")).toBeInTheDocument();
});
