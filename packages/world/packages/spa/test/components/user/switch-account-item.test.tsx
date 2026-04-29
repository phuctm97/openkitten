import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { setupUserMocks } from "~/test/components/user/mock-user-better-auth";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function withMenu(children: ReactNode) {
  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger>open</DropdownMenuTrigger>
      <DropdownMenuContent>{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

const deviceSessionDate = new Date("2026-01-01T00:00:00Z");
const deviceSession = {
  session: {
    createdAt: deviceSessionDate,
    expiresAt: deviceSessionDate,
    id: "s-2",
    token: "tk-2",
    updatedAt: deviceSessionDate,
    userId: "u-2",
  },
  user: {
    createdAt: deviceSessionDate,
    email: "ada@kitten.dev",
    emailVerified: true,
    id: "u-2",
    image: null,
    name: "Ada",
    updatedAt: deviceSessionDate,
  },
};

test("renders the dropdown item with the device session user view", async () => {
  setupUserMocks();
  const { SwitchAccountItem } = await import(
    "~/components/user/switch-account-item"
  );

  render(withMenu(<SwitchAccountItem deviceSession={deviceSession} />));

  expect(screen.getByText("Ada")).toBeInTheDocument();
});

test("calls setActiveSession with the device session token on select", async () => {
  const { setActiveSession } = setupUserMocks();
  const { SwitchAccountItem } = await import(
    "~/components/user/switch-account-item"
  );

  render(withMenu(<SwitchAccountItem deviceSession={deviceSession} />));
  fireEvent.click(screen.getByText("Ada"));

  expect(setActiveSession).toHaveBeenCalledWith({ sessionToken: "tk-2" });
});

test("disables the item and renders a spinner while setActiveSession is pending", async () => {
  setupUserMocks({ pending: { setActiveSession: true } });
  const { SwitchAccountItem } = await import(
    "~/components/user/switch-account-item"
  );

  render(withMenu(<SwitchAccountItem deviceSession={deviceSession} />));

  expect(screen.getByRole("status")).toBeInTheDocument();
});
