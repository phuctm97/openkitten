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

function mockPasskey() {
  vi.doMock("~/components/settings/security/passkey", () => ({
    Passkey: ({ passkey }: { passkey: { id: string } }) => (
      <div data-testid={`passkey-${passkey.id}`} />
    ),
  }));
}

test("renders all passkeys and adds a new one on click", async () => {
  mockSonner();
  const mocks = setupSettingsMocks({
    passkeys: [
      { id: "p-1", name: "Phone", createdAt: new Date(0) },
      { id: "p-2", name: null, createdAt: new Date(0) },
    ],
  });
  mockPasskey();
  const { Passkeys } = await import("~/components/settings/security/passkeys");

  render(<Passkeys className="card" />);

  expect(screen.getByTestId("passkey-p-1")).toBeInTheDocument();
  expect(screen.getByTestId("passkey-p-2")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Add passkey/u }));
  expect(mocks.addPasskey).toHaveBeenCalled();
});

test("renders a skeleton row while passkeys are loading", async () => {
  mockSonner();
  setupSettingsMocks({
    pending: { listUserPasskeys: true },
  });
  mockPasskey();
  const { Passkeys } = await import("~/components/settings/security/passkeys");

  const { container } = render(<Passkeys />);

  expect(
    container.querySelectorAll("[data-slot='skeleton']").length,
  ).toBeGreaterThan(0);
});

test("disables the add button when an add operation is pending", async () => {
  mockSonner();
  setupSettingsMocks({
    passkeys: [],
    pending: { addPasskey: true },
  });
  mockPasskey();
  const { Passkeys } = await import("~/components/settings/security/passkeys");

  render(<Passkeys />);

  expect(screen.getByRole("button", { name: /Add passkey/u })).toBeDisabled();
});

test("survives a missing passkeys list", async () => {
  mockSonner();
  setupSettingsMocks({ passkeys: null });
  mockPasskey();
  const { Passkeys } = await import("~/components/settings/security/passkeys");

  render(<Passkeys />);

  expect(screen.getByText("Passkeys")).toBeInTheDocument();
});
