import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  defaultUserSession,
  type SessionData,
  setupUserMocks,
} from "~/test/components/user/mock-user-better-auth";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function withSubMenu(children: ReactNode) {
  return (
    <DropdownMenu open onOpenChange={() => {}}>
      <DropdownMenuTrigger>menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuSub open onOpenChange={() => {}}>
          <DropdownMenuSubTrigger>open</DropdownMenuSubTrigger>
          {children}
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const otherSession: SessionData = {
  session: { id: "s-2", token: "tk-2", userId: "u-2" },
  user: {
    displayUsername: null,
    email: "ada@kitten.dev",
    id: "u-2",
    image: null,
    name: "Ada",
    username: null,
  },
};

const anotherSession: SessionData = {
  session: { id: "s-3", token: "tk-3", userId: "u-3" },
  user: {
    displayUsername: null,
    email: "bob@kitten.dev",
    id: "u-3",
    image: null,
    name: "Bob",
    username: null,
  },
};

test("renders only non-current sessions as switch items, current with check", async () => {
  setupUserMocks({
    deviceSessions: [defaultUserSession, otherSession, anotherSession],
  });
  const { SwitchAccountMenu } = await import(
    "~/components/user/switch-account-menu"
  );

  render(withSubMenu(<SwitchAccountMenu />));

  expect(screen.getByText("Ada")).toBeInTheDocument();
  expect(screen.getByText("Bob")).toBeInTheDocument();
  expect(screen.getByText("Open Kitten")).toBeInTheDocument();
  expect(screen.queryAllByText("Open Kitten")).toHaveLength(1);
});

test("hides the check icon and skips device session items while listing is pending", async () => {
  setupUserMocks({
    deviceSessions: null,
    pending: { listDeviceSessions: true },
  });
  const { SwitchAccountMenu } = await import(
    "~/components/user/switch-account-menu"
  );

  render(withSubMenu(<SwitchAccountMenu />));

  expect(document.body.querySelector(".lucide-check")).toBeNull();
  expect(screen.queryByText("Ada")).not.toBeInTheDocument();
});

test("renders the current user with check and add account when no extra sessions", async () => {
  setupUserMocks({ deviceSessions: [defaultUserSession] });
  const { SwitchAccountMenu } = await import(
    "~/components/user/switch-account-menu"
  );

  render(withSubMenu(<SwitchAccountMenu />));

  expect(document.body.querySelector(".lucide-check")).not.toBeNull();
  expect(screen.getByText(/add account/i)).toBeInTheDocument();
});

test("add account link points to the configured sign-in path", async () => {
  setupUserMocks();
  const { SwitchAccountMenu } = await import(
    "~/components/user/switch-account-menu"
  );

  render(withSubMenu(<SwitchAccountMenu />));

  const item = screen.getByRole("menuitem", { name: /add account/i });
  expect(item.tagName).toBe("A");
  expect(item).toHaveAttribute("href", "/auth/sign-in");
});
