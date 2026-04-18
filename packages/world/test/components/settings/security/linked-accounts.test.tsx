import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  createMockAccount,
  mockSonnerToast,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

test("renders loading placeholders while linked accounts are loading", async () => {
  setupBetterAuthUiMocks({
    auth: {
      socialProviders: ["github", "google"],
    },
    pending: {
      listAccounts: true,
    },
  });
  const { LinkedAccounts } = await import(
    "~/components/settings/security/linked-accounts"
  );

  render(<LinkedAccounts />);

  expect(screen.getByText("Linked accounts")).toBeInTheDocument();
  expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBe(6);
});

test("filters credential accounts and renders account rows plus link rows", async () => {
  setupBetterAuthUiMocks({
    accounts: [
      createMockAccount({
        accountId: "credential-account",
        id: "credential-account",
        providerId: "credential",
      }),
      createMockAccount(),
    ],
  });
  vi.doMock("~/components/settings/security/linked-account", () => ({
    LinkedAccount: ({
      account,
      provider,
    }: {
      account?: { providerId: string };
      provider: string;
    }) => (
      <div
        data-testid={`linked-account-${provider}-${account ? "existing" : "new"}`}
      />
    ),
  }));
  const { LinkedAccounts } = await import(
    "~/components/settings/security/linked-accounts"
  );

  render(<LinkedAccounts />);

  expect(
    screen.getByTestId("linked-account-github-existing"),
  ).toBeInTheDocument();
  expect(screen.getByTestId("linked-account-github-new")).toBeInTheDocument();
  expect(screen.getByTestId("linked-account-google-new")).toBeInTheDocument();
  expect(screen.queryByTestId("linked-account-credential-existing")).toBeNull();
});

test("forwards account list errors to toast and returns false", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks();
  const { LinkedAccounts } = await import(
    "~/components/settings/security/linked-accounts"
  );

  render(<LinkedAccounts />);

  expect(
    mocks.captured.listAccounts?.throwOnError?.({
      error: { message: "Unable to load linked accounts" },
    }),
  ).toBe(false);
  expect(
    mocks.captured.listAccounts?.throwOnError?.({
      message: "Ignored",
    }),
  ).toBe(false);
  expect(toast.toastError).toHaveBeenCalledWith(
    "Unable to load linked accounts",
  );
});

test("renders without rows when accounts and providers are unavailable", async () => {
  setupBetterAuthUiMocks({
    accounts: [],
    auth: {
      socialProviders: [],
    },
  });
  const { LinkedAccounts } = await import(
    "~/components/settings/security/linked-accounts"
  );

  render(<LinkedAccounts />);

  expect(screen.queryByTestId(/linked-account-/)).toBeNull();
});

test("renders without rows when linked account data is undefined", async () => {
  vi.doMock("@better-auth-ui/react", () => ({
    useAuth: () => ({
      localization: {
        settings: {
          linkedAccounts: "Linked accounts",
        },
      },
      socialProviders: undefined,
    }),
    useListAccounts: () => ({
      data: undefined,
      isPending: false,
    }),
  }));
  vi.doMock("~/components/settings/security/linked-account", () => ({
    LinkedAccount: () => <div data-testid="linked-account-row" />,
  }));
  const { LinkedAccounts } = await import(
    "~/components/settings/security/linked-accounts"
  );

  render(<LinkedAccounts />);

  expect(screen.queryByTestId("linked-account-row")).toBeNull();
});
