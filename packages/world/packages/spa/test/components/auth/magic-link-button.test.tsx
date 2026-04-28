import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { setupBetterAuthUiMocks } from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

test("links back to password sign-in from the magic-link view", async () => {
  setupBetterAuthUiMocks();
  const { MagicLinkButton } = await import(
    "~/components/auth/magic-link-button"
  );

  render(<MagicLinkButton isPending={false} view="magicLink" />);

  const link = screen.getByRole("link", { name: "Continue with Password" });

  expect(link).toHaveAttribute("href", "/auth/sign-in");
  expect(link.querySelector("svg")).not.toBeNull();
});

test("links to the magic-link view from the regular sign-in flow", async () => {
  setupBetterAuthUiMocks();
  const { MagicLinkButton } = await import(
    "~/components/auth/magic-link-button"
  );

  render(<MagicLinkButton isPending view="signIn" />);

  const link = screen.getByRole("link", { name: "Continue with Magic link" });

  expect(link).toHaveAttribute("href", "/auth/magic-link");
  expect(link).toHaveAttribute("disabled");
});
