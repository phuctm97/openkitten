import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, expect, test, vi } from "vitest";

import { setupBetterAuthUiMocks } from "~/test/components/auth/mock-better-auth-ui";

function mockUserButtonChrome() {
  const closeAutoFocusPrevented = vi.fn();
  const themeItemPrevented = vi.fn();

  vi.doMock("~/components/ui/dropdown-menu", () => ({
    DropdownMenu: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DropdownMenuContent: ({
      align,
      children,
      onCloseAutoFocus,
      sideOffset,
    }: {
      align?: string;
      children: ReactNode;
      onCloseAutoFocus?: (event: { preventDefault: () => void }) => void;
      sideOffset?: number;
    }) => (
      <div
        data-testid="dropdown-content"
        data-align={align}
        data-side-offset={String(sideOffset ?? 0)}
      >
        <button
          data-testid="close-auto-focus"
          onClick={() =>
            onCloseAutoFocus?.({
              preventDefault: closeAutoFocusPrevented,
            } as never)
          }
          type="button"
        />
        {children}
      </div>
    ),
    DropdownMenuItem: ({
      children,
      onSelect,
      ...props
    }: ComponentProps<"div"> & {
      onSelect?: (event: { preventDefault: () => void }) => void;
    }) => (
      <div {...props}>
        {children}
        {onSelect && (
          <button
            data-testid="menu-item-select"
            onClick={() =>
              onSelect({
                preventDefault: themeItemPrevented,
              } as never)
            }
            type="button"
          />
        )}
      </div>
    ),
    DropdownMenuLabel: ({ children, ...props }: ComponentProps<"div">) => (
      <div {...props}>{children}</div>
    ),
    DropdownMenuSeparator: (props: ComponentProps<"hr">) => <hr {...props} />,
    DropdownMenuSub: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DropdownMenuSubTrigger: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DropdownMenuTrigger: ({
      children,
      className,
    }: {
      children: ReactNode;
      className?: string;
    }) => (
      <div className={className} data-testid="dropdown-trigger">
        {children}
      </div>
    ),
  }));
  vi.doMock("~/components/ui/tabs", () => ({
    Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    TabsTrigger: ({
      children,
      value,
    }: {
      children: ReactNode;
      value: string;
    }) => (
      <button data-testid={`theme-${value}`} type="button">
        {children}
      </button>
    ),
  }));
  vi.doMock("~/components/user/switch-account-menu", () => ({
    SwitchAccountMenu: () => <div data-testid="switch-account-menu" />,
  }));
  vi.doMock("~/components/user/user-avatar", () => ({
    UserAvatar: () => <div data-testid="user-avatar" />,
  }));
  vi.doMock("~/components/user/user-view", () => ({
    UserView: ({ isPending }: { isPending?: boolean }) => (
      <div data-testid="user-view" data-pending={String(!!isPending)} />
    ),
  }));

  return {
    closeAutoFocusPrevented,
    themeItemPrevented,
  };
}

beforeEach(() => {
  vi.resetModules();
});

test("renders signed-in actions, theme toggles, and switch account controls", async () => {
  const chrome = mockUserButtonChrome();
  setupBetterAuthUiMocks();
  const { UserButton } = await import("~/components/user/user-button");

  render(<UserButton align="end" sideOffset={12} />);

  expect(screen.getAllByTestId("user-view")[0]).toHaveAttribute(
    "data-pending",
    "false",
  );
  expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
    "href",
    "/settings/account",
  );
  expect(screen.getByTestId("switch-account-menu")).toBeInTheDocument();
  expect(screen.getByTestId("theme-system")).toBeInTheDocument();
  expect(screen.getByTestId("theme-light")).toBeInTheDocument();
  expect(screen.getByTestId("theme-dark")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Sign out" })).toHaveAttribute(
    "href",
    "/auth/sign-out",
  );

  fireEvent.click(screen.getByTestId("close-auto-focus"));
  fireEvent.click(screen.getByTestId("menu-item-select"));

  expect(chrome.closeAutoFocusPrevented).toHaveBeenCalled();
  expect(chrome.themeItemPrevented).toHaveBeenCalled();
});

test("renders signed-out links and icon trigger when no session exists", async () => {
  setupBetterAuthUiMocks({
    session: null,
  });
  mockUserButtonChrome();
  const { UserButton } = await import("~/components/user/user-button");

  render(<UserButton size="icon" themeToggle={false} />);

  expect(screen.getByTestId("dropdown-trigger")).toHaveClass("rounded-full");
  expect(screen.getByTestId("user-avatar")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/auth/sign-in",
  );
  expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
    "href",
    "/auth/sign-up",
  );
});

test("renders the pending user view while the session is loading", async () => {
  setupBetterAuthUiMocks({
    pending: {
      session: true,
    },
    session: null,
  });
  mockUserButtonChrome();
  const { UserButton } = await import("~/components/user/user-button");

  render(<UserButton />);

  expect(screen.getAllByTestId("user-view")[0]).toHaveAttribute(
    "data-pending",
    "false",
  );
  expect(screen.queryByText("Account")).toBeNull();
});

test("marks the trigger user view as pending while account switching is in flight", async () => {
  setupBetterAuthUiMocks({
    pending: {
      setActiveSession: true,
    },
    session: null,
  });
  mockUserButtonChrome();
  const { UserButton } = await import("~/components/user/user-button");

  render(<UserButton />);

  expect(screen.getAllByTestId("user-view")[0]).toHaveAttribute(
    "data-pending",
    "true",
  );
});

test("renders the default signed-out trigger label when no session is available", async () => {
  setupBetterAuthUiMocks({
    session: null,
  });
  mockUserButtonChrome();
  const { UserButton } = await import("~/components/user/user-button");

  render(<UserButton />);

  expect(screen.getByText("Account")).toBeInTheDocument();
});
