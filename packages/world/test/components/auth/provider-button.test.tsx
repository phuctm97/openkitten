import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { setupBetterAuthUiMocks } from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
});

test("starts provider sign-in and shows a spinner while redirecting", async () => {
  vi.useFakeTimers();

  const mocks = setupBetterAuthUiMocks();
  const { ProviderButton } = await import("~/components/auth/provider-button");

  render(<ProviderButton provider="github" />);

  fireEvent.click(screen.getByRole("button", { name: "Continue with Github" }));

  expect(mocks.signInSocial).toHaveBeenCalledWith({
    callbackURL: "https://world.openkitten.dev/play",
    provider: "github",
  });

  await act(async () => {
    await mocks.captured.signInSocial?.onSuccess?.();
  });

  expect(screen.getByRole("button")).toBeDisabled();
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();

  await act(async () => {
    vi.advanceTimersByTime(5000);
  });

  expect(screen.queryByRole("status", { name: "Loading" })).toBeNull();
});

test("supports provider-name and icon-only labels", async () => {
  setupBetterAuthUiMocks();
  const { ProviderButton } = await import("~/components/auth/provider-button");

  const { rerender } = render(
    <ProviderButton provider="github" label="providerName" />,
  );

  expect(screen.getByRole("button", { name: "Github" })).toBeInTheDocument();

  rerender(
    <ProviderButton aria-label="Google" label="none" provider="google" />,
  );

  expect(screen.getByRole("button", { name: "Google" })).toBeInTheDocument();
});

test("formats provider names even when the id starts with a separator", async () => {
  setupBetterAuthUiMocks({
    providerIcons: {
      "-custom": (props) => (
        <svg data-testid="provider-icon-custom" {...props} />
      ),
    },
  });
  const { ProviderButton } = await import("~/components/auth/provider-button");

  render(<ProviderButton provider="-custom" label="providerName" />);

  expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();
});

test("renders without an icon when the provider icon is unavailable", async () => {
  setupBetterAuthUiMocks({
    providerIcons: {},
  });
  const { ProviderButton } = await import("~/components/auth/provider-button");

  render(<ProviderButton provider="unknown" />);

  const button = screen.getByRole("button", { name: "Continue with Unknown" });

  expect(button.querySelector("svg")).toBeNull();
});

test("honors external disabled and pending states", async () => {
  setupBetterAuthUiMocks({
    pending: {
      signInSocial: true,
    },
  });
  const { ProviderButton } = await import("~/components/auth/provider-button");

  render(<ProviderButton className="grow" isDisabled provider="github" />);

  expect(screen.getByRole("button")).toBeDisabled();
  expect(screen.getByRole("button")).toHaveClass("grow");
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});
