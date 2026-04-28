import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { setupBetterAuthUiMocks } from "~/test/components/auth/mock-better-auth-ui";

function mockProviderButton() {
  vi.doMock("~/components/auth/provider-button", () => ({
    ProviderButton: ({
      className,
      isDisabled,
      label,
      provider,
    }: {
      className?: string;
      isDisabled?: boolean;
      label?: string;
      provider: string;
    }) => (
      <div
        data-testid={`provider-button-${provider}`}
        data-disabled={String(isDisabled)}
        data-label={label}
        className={className}
      />
    ),
  }));
}

beforeEach(() => {
  vi.resetModules();
});

test("uses a vertical layout by default for a small provider list", async () => {
  setupBetterAuthUiMocks({
    auth: {
      socialProviders: ["github", "google"],
    },
  });
  mockProviderButton();
  const { ProviderButtons } = await import(
    "~/components/auth/provider-buttons"
  );

  render(<ProviderButtons isPending />);

  expect(
    screen.getByTestId("provider-button-github").parentElement,
  ).toHaveClass("flex", "flex-col");
  expect(screen.getByTestId("provider-button-github")).toHaveAttribute(
    "data-disabled",
    "true",
  );
  expect(screen.getByTestId("provider-button-github")).toHaveAttribute(
    "data-label",
    "continueWith",
  );
});

test("switches to a horizontal layout when enough providers are available", async () => {
  setupBetterAuthUiMocks({
    auth: {
      socialProviders: ["github", "google", "discord", "apple"],
    },
  });
  mockProviderButton();
  const { ProviderButtons } = await import(
    "~/components/auth/provider-buttons"
  );

  render(<ProviderButtons isPending />);

  expect(
    screen.getByTestId("provider-button-github").parentElement,
  ).toHaveClass("flex", "flex-row", "flex-wrap");
  expect(screen.getByTestId("provider-button-github")).toHaveAttribute(
    "data-label",
    "none",
  );
  expect(screen.getByTestId("provider-button-github")).toHaveClass("flex-1");
});

test("supports a grid layout", async () => {
  setupBetterAuthUiMocks({
    auth: {
      socialProviders: ["github"],
    },
  });
  mockProviderButton();
  const { ProviderButtons } = await import(
    "~/components/auth/provider-buttons"
  );

  render(<ProviderButtons isPending={false} socialLayout="grid" />);

  expect(
    screen.getByTestId("provider-button-github").parentElement,
  ).toHaveClass("grid", "grid-cols-2");
  expect(screen.getByTestId("provider-button-github")).toHaveAttribute(
    "data-label",
    "providerName",
  );
});
