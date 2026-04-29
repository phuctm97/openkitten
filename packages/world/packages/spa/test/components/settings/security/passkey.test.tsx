import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  mockSonner,
  setupSettingsMocks,
} from "~/test/components/settings/mock-better-auth-ui-settings";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("renders the named passkey row and deletes via the mutation", async () => {
  mockSonner();
  const mocks = setupSettingsMocks();
  const { Passkey } = await import("~/components/settings/security/passkey");

  render(
    <Passkey passkey={{ id: "p-1", name: "Phone", createdAt: new Date(0) }} />,
  );

  expect(screen.getByText("Phone")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Delete/u }));
  expect(mocks.deletePasskey).toHaveBeenCalledWith({ id: "p-1" });
});

test("falls back to the localized label when no name is set", async () => {
  mockSonner();
  setupSettingsMocks();
  const { Passkey } = await import("~/components/settings/security/passkey");

  render(
    <Passkey passkey={{ id: "p-2", name: null, createdAt: new Date(0) }} />,
  );

  expect(screen.getByText("Passkey")).toBeInTheDocument();
});

test("renders a spinner when deletion is pending", async () => {
  mockSonner();
  setupSettingsMocks({ pending: { deletePasskey: true } });
  const { Passkey } = await import("~/components/settings/security/passkey");

  render(
    <Passkey passkey={{ id: "p-3", name: "Laptop", createdAt: new Date(0) }} />,
  );

  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Delete/u })).toBeDisabled();
});
