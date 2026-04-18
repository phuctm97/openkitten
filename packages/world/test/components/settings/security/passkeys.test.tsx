import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  createMockPasskey,
  mockSonnerToast,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

test("renders passkey loading placeholders while the list is loading", async () => {
  setupBetterAuthUiMocks({
    pending: {
      listUserPasskeys: true,
    },
  });
  const { Passkeys } = await import("~/components/settings/security/passkeys");

  render(<Passkeys />);

  expect(screen.getByRole("button", { name: /add passkey/i })).toBeDisabled();
  expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBe(3);
});

test("renders each passkey row when data is available", async () => {
  setupBetterAuthUiMocks({
    passkeys: [
      createMockPasskey(),
      createMockPasskey({ id: "passkey-2", name: "Phone" }),
    ],
  });
  vi.doMock("~/components/settings/security/passkey", () => ({
    Passkey: ({ passkey }: { passkey: { id: string } }) => (
      <div data-testid={`passkey-${passkey.id}`} />
    ),
  }));
  const { Passkeys } = await import("~/components/settings/security/passkeys");

  render(<Passkeys />);

  expect(screen.getByTestId("passkey-passkey-1")).toBeInTheDocument();
  expect(screen.getByTestId("passkey-passkey-2")).toBeInTheDocument();
});

test("adds a passkey when the button is pressed", async () => {
  const mocks = setupBetterAuthUiMocks();
  const { Passkeys } = await import("~/components/settings/security/passkeys");

  render(<Passkeys />);

  fireEvent.click(screen.getByRole("button", { name: /add passkey/i }));

  expect(mocks.addPasskey).toHaveBeenCalled();
});

test("shows the add-passkey spinner and forwards list and mutation errors", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    pending: {
      addPasskey: true,
    },
  });
  const { Passkeys } = await import("~/components/settings/security/passkeys");

  render(<Passkeys />);

  expect(screen.getByRole("button", { name: /add passkey/i })).toBeDisabled();
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  expect(
    mocks.captured.listUserPasskeys?.throwOnError?.({
      error: { message: "Unable to load passkeys" },
    }),
  ).toBe(false);
  mocks.captured.addPasskey?.onError?.({
    error: { message: "Unable to add passkey" },
  });

  expect(toast.toastError).toHaveBeenCalledWith("Unable to load passkeys");
  expect(toast.toastError).toHaveBeenCalledWith("Unable to add passkey");
});
