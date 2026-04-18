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

test("renders a named passkey and deletes it", async () => {
  const mocks = setupBetterAuthUiMocks();
  const { Passkey } = await import("~/components/settings/security/passkey");

  render(<Passkey passkey={createMockPasskey()} />);

  expect(screen.getByText("MacBook Pro")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(mocks.deletePasskey).toHaveBeenCalledWith({ id: "passkey-1" });
});

test("falls back to the localized label when the passkey has no name", async () => {
  setupBetterAuthUiMocks();
  const { Passkey } = await import("~/components/settings/security/passkey");

  render(
    <Passkey
      passkey={createMockPasskey({
        id: "passkey-2",
        name: "",
      })}
    />,
  );

  expect(screen.getByText("Passkey")).toBeInTheDocument();
});

test("shows the pending state and forwards delete errors", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    pending: {
      deletePasskey: true,
    },
  });
  const { Passkey } = await import("~/components/settings/security/passkey");

  render(<Passkey passkey={createMockPasskey()} />);

  expect(screen.getByRole("button", { name: /delete/i })).toBeDisabled();
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();

  mocks.captured.deletePasskey?.onError?.({
    error: { message: "Unable to delete passkey" },
  });

  expect(toast.toastError).toHaveBeenCalledWith("Unable to delete passkey");
});
