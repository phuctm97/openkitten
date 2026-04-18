import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  createMockSession,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

function mockDropdownMenu() {
  vi.doMock("~/components/ui/dropdown-menu", () => ({
    DropdownMenuItem: ({ children, ...props }: ComponentProps<"div">) => (
      <div {...props}>{children}</div>
    ),
    DropdownMenuSeparator: (props: ComponentProps<"hr">) => <hr {...props} />,
    DropdownMenuSubContent: ({
      children,
      className,
    }: ComponentProps<"div">) => (
      <div className={className} data-testid="switch-account-menu">
        {children}
      </div>
    ),
  }));
}

beforeEach(() => {
  vi.resetModules();
});

test("renders the current account, other sessions, and add-account link", async () => {
  const current = createMockSession();
  const other = createMockSession({
    session: { id: "session-2", token: "session-token-2" },
    user: { email: "other@openkitten.dev", name: "Other Kitten" },
  });

  setupBetterAuthUiMocks({
    deviceSessions: [current, other],
    session: current,
  });
  mockDropdownMenu();
  vi.doMock("~/components/user/switch-account-item", () => ({
    SwitchAccountItem: ({
      deviceSession,
    }: {
      deviceSession: { session: { id: string } };
    }) => <div data-testid={`switch-item-${deviceSession.session.id}`} />,
  }));
  vi.doMock("~/components/user/user-view", () => ({
    UserView: ({ isPending }: { isPending?: boolean }) => (
      <div data-testid="current-user-view" data-pending={String(!!isPending)} />
    ),
  }));
  const { SwitchAccountMenu } = await import(
    "~/components/user/switch-account-menu"
  );

  render(<SwitchAccountMenu />);

  expect(screen.getByTestId("switch-account-menu")).toBeInTheDocument();
  expect(screen.getByTestId("current-user-view")).toHaveAttribute(
    "data-pending",
    "false",
  );
  expect(screen.getByTestId("switch-item-session-2")).toBeInTheDocument();
  expect(screen.queryByTestId("switch-item-session-1")).toBeNull();
  expect(screen.getByRole("link", { name: "Add account" })).toHaveAttribute(
    "href",
    "/auth/sign-in",
  );
});
