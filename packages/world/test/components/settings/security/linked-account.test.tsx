import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  createMockAccount,
  mockSonnerToast,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

test("renders linked account details and unlinks an existing provider", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    accountInfo: {
      data: {
        login: "pixelcat",
      },
    },
  });
  const { LinkedAccount } = await import(
    "~/components/settings/security/linked-account"
  );

  render(<LinkedAccount account={createMockAccount()} provider="github" />);

  expect(screen.getByText("Github")).toBeInTheDocument();
  expect(screen.getByText("pixelcat")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Unlink Github" }));
  expect(mocks.unlinkAccount).toHaveBeenCalledWith({ providerId: "github" });
  expect(
    mocks.captured.accountInfo?.throwOnError?.({
      error: { message: "Unable to load account info" },
    }),
  ).toBe(false);
  mocks.captured.unlinkAccount?.onSuccess?.();
  mocks.captured.unlinkAccount?.onError?.({
    error: { message: "Unable to unlink account" },
  });

  expect(toast.toastError).toHaveBeenCalledWith("Unable to load account info");
  expect(toast.toastSuccess).toHaveBeenCalledWith("Account unlinked");
  expect(toast.toastError).toHaveBeenCalledWith("Unable to unlink account");
});

test("links a new provider when no account is connected", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks();
  const { LinkedAccount } = await import(
    "~/components/settings/security/linked-account"
  );

  render(<LinkedAccount provider="google" />);

  fireEvent.click(screen.getByRole("button", { name: "Link Google" }));
  expect(mocks.linkSocial).toHaveBeenCalledWith({
    callbackURL: "https://world.openkitten.dev/",
    provider: "google",
  });
  mocks.captured.linkSocial?.onError?.({
    error: { message: "Unable to link account" },
  });
  expect(toast.toastError).toHaveBeenCalledWith("Unable to link account");
});

test("shows a loading skeleton for an existing linked account", async () => {
  setupBetterAuthUiMocks({
    pending: {
      accountInfo: true,
    },
  });
  const { LinkedAccount } = await import(
    "~/components/settings/security/linked-account"
  );

  render(<LinkedAccount account={createMockAccount()} provider="github" />);

  expect(document.querySelector('[data-slot="skeleton"]')).not.toBeNull();
});

test("shows the pending state while unlinking a provider", async () => {
  setupBetterAuthUiMocks({
    pending: {
      unlinkAccount: true,
    },
  });
  const { LinkedAccount } = await import(
    "~/components/settings/security/linked-account"
  );

  render(<LinkedAccount account={createMockAccount()} provider="github" />);

  expect(screen.getByRole("button", { name: /unlink github/i })).toBeDisabled();
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});

test("shows the pending state while linking a provider", async () => {
  const linkMocks = setupBetterAuthUiMocks({
    pending: {
      linkSocial: true,
    },
  });
  const { LinkedAccount } = await import(
    "~/components/settings/security/linked-account"
  );

  render(<LinkedAccount provider="google" />);

  expect(screen.getByRole("button", { name: /link google/i })).toBeDisabled();
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  expect(linkMocks.linkSocial).not.toHaveBeenCalled();
});

test("falls back to the generic provider icon when no provider icon is registered", async () => {
  setupBetterAuthUiMocks();
  const { LinkedAccount } = await import(
    "~/components/settings/security/linked-account"
  );

  const { container } = render(<LinkedAccount provider={"apple" as never} />);

  expect(container.querySelector("svg")).not.toBeNull();
  expect(
    screen.getByRole("button", { name: /link apple/i }),
  ).toBeInTheDocument();
});
