import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  mockSonnerToast,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

function mockNestedAuthComponents() {
  vi.doMock("~/components/auth/magic-link-button", () => ({
    MagicLinkButton: ({
      isPending,
      view,
    }: {
      isPending: boolean;
      view?: string;
    }) => (
      <div
        data-testid="magic-link-button"
        data-pending={String(isPending)}
        data-view={view}
      />
    ),
  }));

  vi.doMock("~/components/auth/passkey-button", () => ({
    PasskeyButton: ({ isPending }: { isPending: boolean }) => (
      <div data-testid="passkey-button" data-pending={String(isPending)} />
    ),
  }));

  vi.doMock("~/components/auth/provider-buttons", () => ({
    ProviderButtons: ({
      isPending,
      socialLayout,
    }: {
      isPending: boolean;
      socialLayout?: string;
    }) => (
      <div
        data-testid="provider-buttons"
        data-pending={String(isPending)}
        data-social-layout={socialLayout}
      />
    ),
  }));
}

beforeEach(() => {
  vi.resetModules();
});

test("submits magic-link requests and renders the default bottom layout", async () => {
  mockSonnerToast();
  const mocks = setupBetterAuthUiMocks();
  mockNestedAuthComponents();
  const { MagicLink } = await import("~/components/auth/magic-link");

  render(<MagicLink className="magic-card" socialLayout="grid" />);

  const emailInput = screen.getByLabelText("Email");

  Object.defineProperty(emailInput, "validationMessage", {
    configurable: true,
    value: "Email is required",
  });

  fireEvent.invalid(emailInput);

  expect(screen.getByRole("alert")).toHaveTextContent("Email is required");

  fireEvent.change(emailInput, { target: { value: "magic@openkitten.dev" } });

  expect(screen.queryByRole("alert")).toBeNull();

  fireEvent.submit(screen.getByRole("button", { name: "Send magic link" }));

  expect(mocks.signInMagicLink).toHaveBeenCalledWith({
    callbackURL: "https://world.openkitten.dev/play",
    email: "magic@openkitten.dev",
  });
  expect(screen.getByTestId("provider-buttons")).toHaveAttribute(
    "data-social-layout",
    "grid",
  );
  expect(screen.getByTestId("magic-link-button")).toHaveAttribute(
    "data-view",
    "magicLink",
  );
  expect(screen.getByTestId("passkey-button")).toHaveAttribute(
    "data-pending",
    "false",
  );
  expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
    "href",
    "/auth/sign-up",
  );
});

test("handles success in the top layout", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    auth: {
      passkey: false,
      socialProviders: ["github"],
    },
  });
  mockNestedAuthComponents();
  const { MagicLink } = await import("~/components/auth/magic-link");

  render(<MagicLink socialLayout="vertical" socialPosition="top" />);

  const emailInput = screen.getByLabelText("Email");

  fireEvent.change(emailInput, { target: { value: "top@openkitten.dev" } });

  await act(async () => {
    mocks.captured.signInMagicLink?.onSuccess?.();
  });

  expect(emailInput).toHaveValue("");
  expect(toast.toastSuccess).toHaveBeenCalledWith("Magic link sent");
  expect(screen.getByText("Or")).toBeInTheDocument();
  expect(screen.getByTestId("provider-buttons")).toHaveAttribute(
    "data-pending",
    "false",
  );
  expect(screen.queryByTestId("passkey-button")).toBeNull();
});

test("omits social affordances when no providers are configured", async () => {
  mockSonnerToast();
  setupBetterAuthUiMocks({
    auth: {
      passkey: false,
      socialProviders: [],
    },
  });
  mockNestedAuthComponents();
  const { MagicLink } = await import("~/components/auth/magic-link");

  render(<MagicLink />);

  expect(screen.queryByTestId("provider-buttons")).toBeNull();
  expect(screen.queryByText("Or")).toBeNull();
  expect(screen.queryByTestId("passkey-button")).toBeNull();
});

test("shows a spinner while a magic-link request is pending", async () => {
  mockSonnerToast();
  setupBetterAuthUiMocks({
    pending: {
      signInMagicLink: true,
    },
  });
  mockNestedAuthComponents();
  const { MagicLink } = await import("~/components/auth/magic-link");

  render(<MagicLink />);

  expect(
    screen.getByRole("button", { name: /Send magic link/u }),
  ).toBeDisabled();
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  expect(screen.getByTestId("provider-buttons")).toHaveAttribute(
    "data-pending",
    "true",
  );
  expect(screen.getByTestId("passkey-button")).toHaveAttribute(
    "data-pending",
    "true",
  );
});
