import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { setupBetterAuthUiMocks } from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

test("uses a vertical layout by default for a small provider list", async () => {
  setupBetterAuthUiMocks({
    auth: {
      socialProviders: ["github", "google"],
    },
  });
  const { ProviderButtons } = await import(
    "~/components/auth/provider-buttons"
  );
  const signInSocial = vi.fn();

  render(<ProviderButtons isPending={false} signInSocial={signInSocial} />);

  const githubButton = screen.getByRole("button", {
    name: "Continue with Github",
  });

  fireEvent.click(githubButton);

  expect(githubButton.parentElement).toHaveClass("flex", "flex-col");
  expect(signInSocial).toHaveBeenCalledWith({
    callbackURL: "https://world.openkitten.dev/play",
    provider: "github",
  });
});

test("switches to a horizontal layout when enough providers are available", async () => {
  setupBetterAuthUiMocks({
    auth: {
      socialProviders: ["github", "google", "discord", "apple"],
    },
    providerIcons: {
      apple: (props) => <svg data-testid="provider-icon-apple" {...props} />,
      discord: (props) => (
        <svg data-testid="provider-icon-discord" {...props} />
      ),
      github: (props) => <svg data-testid="provider-icon-github" {...props} />,
      google: (props) => <svg data-testid="provider-icon-google" {...props} />,
    },
  });
  const { ProviderButtons } = await import(
    "~/components/auth/provider-buttons"
  );

  render(<ProviderButtons isPending signInSocial={vi.fn()} />);

  const buttons = screen.getAllByRole("button");

  expect(buttons).toHaveLength(4);
  expect(buttons[0]?.parentElement).toHaveClass(
    "flex",
    "flex-row",
    "flex-wrap",
  );
  expect(screen.queryByText("Continue with Github")).toBeNull();
});

test("supports a grid layout and gracefully handles providers without icons", async () => {
  setupBetterAuthUiMocks({
    auth: {
      socialProviders: ["unknown"],
    },
    providerIcons: {},
  });
  const { ProviderButtons } = await import(
    "~/components/auth/provider-buttons"
  );

  render(
    <ProviderButtons
      isPending={false}
      signInSocial={vi.fn()}
      socialLayout="grid"
    />,
  );

  const button = screen.getByRole("button", { name: "Unknown" });

  expect(button.parentElement).toHaveClass("grid", "grid-cols-2");
  expect(button.querySelector("svg")).toBeNull();
});

test("formats provider names even when a provider id starts with a separator", async () => {
  setupBetterAuthUiMocks({
    auth: {
      socialProviders: ["-custom"],
    },
    providerIcons: {},
  });
  const { ProviderButtons } = await import(
    "~/components/auth/provider-buttons"
  );

  render(
    <ProviderButtons
      isPending={false}
      signInSocial={vi.fn()}
      socialLayout="grid"
    />,
  );

  expect(screen.getByRole("button", { name: /Custom/u })).toBeInTheDocument();
});
