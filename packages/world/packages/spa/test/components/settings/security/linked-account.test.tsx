import { fireEvent, render, screen } from "@testing-library/react";
import type { SVGProps } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  defaultAccount,
  mockSonner,
  setupSettingsMocks,
} from "~/test/components/settings/mock-better-auth-ui-settings";

beforeEach(() => {
  vi.resetModules();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, pathname: "/settings/security" },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("displays the linked account info and unlinks via the mutation", async () => {
  const sonner = mockSonner();
  const mocks = setupSettingsMocks({
    accountInfo: { data: { login: "kitten-dev" } },
  });
  const { LinkedAccount } = await import(
    "~/components/settings/security/linked-account"
  );

  render(
    <LinkedAccount
      account={{
        ...defaultAccount,
        id: "a1",
        accountId: "acc-1",
        providerId: "github",
      }}
      provider="github"
    />,
  );

  expect(screen.getByText("kitten-dev")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Unlink Github" }));
  expect(mocks.unlinkAccount).toHaveBeenCalledWith({ providerId: "github" });

  mocks.captured.unlinkAccount?.onSuccess?.();
  expect(sonner.toastSuccess).toHaveBeenCalledWith("Account unlinked");
});

test("falls back through the display name candidates", async () => {
  mockSonner();
  setupSettingsMocks({
    accountInfo: {
      data: { username: "from-username" },
      user: { email: "fallback@kitten.dev", name: "Kitten" },
    },
  });
  const { LinkedAccount } = await import(
    "~/components/settings/security/linked-account"
  );

  render(
    <LinkedAccount
      account={{
        ...defaultAccount,
        id: "a1",
        accountId: "acc-1",
        providerId: "github",
      }}
      provider="github"
    />,
  );

  expect(screen.getByText("from-username")).toBeInTheDocument();
});

test("falls back to user email and name when both data fields are missing", async () => {
  mockSonner();
  setupSettingsMocks({
    accountInfo: {
      user: { email: "fallback@kitten.dev" },
    },
  });
  const { LinkedAccount } = await import(
    "~/components/settings/security/linked-account"
  );

  render(
    <LinkedAccount
      account={{
        ...defaultAccount,
        id: "a1",
        accountId: "acc-1",
        providerId: "github",
      }}
      provider="github"
    />,
  );

  expect(screen.getByText("fallback@kitten.dev")).toBeInTheDocument();
});

test("falls back to user.name when only the name is present", async () => {
  mockSonner();
  setupSettingsMocks({
    accountInfo: {
      user: { name: "Kitten Name" },
    },
  });
  const { LinkedAccount } = await import(
    "~/components/settings/security/linked-account"
  );

  render(
    <LinkedAccount
      account={{
        ...defaultAccount,
        id: "a1",
        accountId: "acc-1",
        providerId: "github",
      }}
      provider="github"
    />,
  );

  expect(screen.getByText("Kitten Name")).toBeInTheDocument();
});

test("falls back to accountId when no info is available", async () => {
  mockSonner();
  setupSettingsMocks({ accountInfo: null });
  const { LinkedAccount } = await import(
    "~/components/settings/security/linked-account"
  );

  render(
    <LinkedAccount
      account={{
        ...defaultAccount,
        id: "a1",
        accountId: "fallback-acc",
        providerId: "github",
      }}
      provider="github"
    />,
  );

  expect(screen.getByText("fallback-acc")).toBeInTheDocument();
});

test("renders the link CTA when no account is provided and links via window.location.pathname", async () => {
  mockSonner();
  const mocks = setupSettingsMocks();
  const { LinkedAccount } = await import(
    "~/components/settings/security/linked-account"
  );

  render(<LinkedAccount provider="google" />);

  expect(screen.getByText("Link Google")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Link Google" }));
  expect(mocks.linkSocial).toHaveBeenCalledWith({
    provider: "google",
    callbackURL: "https://world.openkitten.dev/settings/security",
  });
});

test("renders the Plug fallback icon when no provider icon is configured", async () => {
  mockSonner();
  setupSettingsMocks({
    providerIcons: {
      github: (props: SVGProps<SVGSVGElement>) => (
        <svg data-testid="icon-github" {...props} />
      ),
    },
  });
  const { LinkedAccount } = await import(
    "~/components/settings/security/linked-account"
  );

  const { container } = render(<LinkedAccount provider="discord" />);
  expect(container.querySelector(".lucide-plug")).not.toBeNull();
});

test("renders a skeleton while account info is loading", async () => {
  mockSonner();
  setupSettingsMocks({
    pending: { loadingInfo: true },
  });
  const { LinkedAccount } = await import(
    "~/components/settings/security/linked-account"
  );

  const { container } = render(
    <LinkedAccount
      account={{
        ...defaultAccount,
        id: "a1",
        accountId: "acc-1",
        providerId: "github",
      }}
      provider="github"
    />,
  );

  expect(container.querySelector("[data-slot='skeleton']")).not.toBeNull();
});

test("shows spinners when link or unlink mutations are pending", async () => {
  mockSonner();
  setupSettingsMocks({
    pending: { linkSocial: true, unlinkAccount: true },
  });
  const { LinkedAccount } = await import(
    "~/components/settings/security/linked-account"
  );

  const { rerender } = render(<LinkedAccount provider="github" />);
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();

  rerender(
    <LinkedAccount
      account={{
        ...defaultAccount,
        id: "a1",
        accountId: "acc-1",
        providerId: "github",
      }}
      provider="github"
    />,
  );
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});
