import { render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { setupUserMocks } from "~/test/components/user/mock-user-better-auth";

type DivProps = ComponentProps<"div">;

beforeEach(() => {
  vi.resetModules();

  vi.doMock("~/components/ui/dropdown-menu", () => {
    function DropdownMenu({ children }: { children?: ReactNode }) {
      return <div data-slot="dropdown-menu">{children}</div>;
    }
    function DropdownMenuTrigger({
      children,
      asChild,
      ...props
    }: { children?: ReactNode; asChild?: boolean } & DivProps) {
      void asChild;
      return (
        <div data-slot="dropdown-menu-trigger" {...props}>
          {children}
        </div>
      );
    }
    function DropdownMenuContent({
      children,
      sideOffset,
      align,
      onCloseAutoFocus,
      ...props
    }: {
      children?: ReactNode;
      sideOffset?: number;
      align?: string;
      onCloseAutoFocus?: (e: { preventDefault: () => void }) => void;
    } & DivProps) {
      void sideOffset;
      void align;
      onCloseAutoFocus?.({ preventDefault: () => undefined });
      return (
        <div
          data-slot="dropdown-menu-content"
          data-testid="dropdown-content"
          {...props}
        >
          {children}
        </div>
      );
    }
    function DropdownMenuItem({
      children,
      asChild,
      onSelect,
      ...props
    }: {
      children?: ReactNode;
      asChild?: boolean;
      onSelect?: (e: { preventDefault: () => void }) => void;
    } & DivProps) {
      void asChild;
      onSelect?.({ preventDefault: () => undefined });
      return (
        <div data-slot="dropdown-menu-item" {...props}>
          {children}
        </div>
      );
    }
    function DropdownMenuLabel({ children, ...props }: DivProps) {
      return (
        <div data-slot="dropdown-menu-label" {...props}>
          {children}
        </div>
      );
    }
    function DropdownMenuSeparator(props: DivProps) {
      return <div data-slot="dropdown-menu-separator" {...props} />;
    }
    function DropdownMenuSub({ children }: { children?: ReactNode }) {
      return <div data-slot="dropdown-menu-sub">{children}</div>;
    }
    function DropdownMenuSubTrigger({ children, ...props }: DivProps) {
      return (
        <div data-slot="dropdown-menu-sub-trigger" {...props}>
          {children}
        </div>
      );
    }

    return {
      DropdownMenu,
      DropdownMenuContent,
      DropdownMenuItem,
      DropdownMenuLabel,
      DropdownMenuSeparator,
      DropdownMenuSub,
      DropdownMenuSubTrigger,
      DropdownMenuTrigger,
    };
  });

  vi.doMock("~/components/ui/tabs", () => {
    function Tabs({
      children,
      value,
      onValueChange,
      ...props
    }: {
      children?: ReactNode;
      value?: string;
      onValueChange?: (value: string) => void;
    } & DivProps) {
      return (
        <div
          data-slot="tabs"
          data-value={value}
          data-on-change={onValueChange ? "yes" : "no"}
          {...props}
        >
          {children}
        </div>
      );
    }
    function TabsList({ children, ...props }: DivProps) {
      return (
        <div data-slot="tabs-list" {...props}>
          {children}
        </div>
      );
    }
    function TabsTrigger({
      children,
      value,
      onClick,
      ...props
    }: {
      children?: ReactNode;
      value?: string;
    } & ComponentProps<"button">) {
      return (
        <button
          type="button"
          data-slot="tabs-trigger"
          data-value={value}
          onClick={(e) => {
            onClick?.(e);
            const list = (e.currentTarget as HTMLElement).closest(
              "[data-slot='tabs']",
            );
            const tabs = list as HTMLElement | null;
            tabs?.setAttribute("data-clicked", value ?? "");
          }}
          {...props}
        >
          {children}
        </button>
      );
    }
    return { Tabs, TabsList, TabsTrigger };
  });

  vi.doMock("~/components/user/switch-account-menu", () => ({
    SwitchAccountMenu: () => <div data-testid="switch-menu" />,
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("~/components/ui/dropdown-menu");
  vi.doUnmock("~/components/ui/tabs");
  vi.doUnmock("~/components/user/switch-account-menu");
});

test("renders only an avatar trigger when size is icon", async () => {
  setupUserMocks();
  const { UserButton } = await import("~/components/user/user-button");

  const { container } = render(<UserButton size="icon" className="extra" />);
  const trigger = container.querySelector(
    "[data-slot='dropdown-menu-trigger']",
  );
  expect(trigger).toHaveClass("rounded-full");
  expect(trigger).toHaveClass("extra");
  expect(container.querySelector("[data-slot='avatar']")).toBeInTheDocument();
});

test("default size shows the user view in the trigger when signed in", async () => {
  setupUserMocks();
  const { UserButton } = await import("~/components/user/user-button");

  render(<UserButton />);
  expect(screen.getAllByText("Open Kitten").length).toBeGreaterThanOrEqual(1);
  expect(
    screen.getAllByText("user-1@kitten.dev").length,
  ).toBeGreaterThanOrEqual(1);
});

test("default size shows the account label when signed out", async () => {
  setupUserMocks({ session: null });
  const { UserButton } = await import("~/components/user/user-button");

  render(<UserButton className="trigger-extra" />);
  expect(screen.getByText("Account")).toBeInTheDocument();
});

test("renders settings link, switch account submenu, theme picker, and sign-out when signed in", async () => {
  const setTheme = vi.fn();
  setupUserMocks({ appearance: { setTheme, theme: "system" } });
  const { UserButton } = await import("~/components/user/user-button");

  render(<UserButton align="end" sideOffset={8} />);

  const settingsLink = screen.getByText("Settings").closest("a");
  expect(settingsLink).toHaveAttribute("href", "/settings/account");
  expect(screen.getByText("Switch account")).toBeInTheDocument();
  expect(screen.getByTestId("switch-menu")).toBeInTheDocument();
  expect(screen.getByText("Theme")).toBeInTheDocument();
  expect(screen.getByLabelText("System")).toBeInTheDocument();
  expect(screen.getByLabelText("Light")).toBeInTheDocument();
  expect(screen.getByLabelText("Dark")).toBeInTheDocument();
  const signOutLink = screen.getByText("Sign out").closest("a");
  expect(signOutLink).toHaveAttribute("href", "/auth/sign-out");
});

test("renders a theme tabs control wired to setTheme", async () => {
  const setTheme = vi.fn();
  setupUserMocks({ appearance: { setTheme, theme: "light" } });
  const { UserButton } = await import("~/components/user/user-button");

  const { container } = render(<UserButton />);

  const tabs = container.querySelector("[data-slot='tabs']");
  expect(tabs).toHaveAttribute("data-value", "light");
  expect(tabs).toHaveAttribute("data-on-change", "yes");
});

test("hides the switch account submenu when multiSession is false", async () => {
  setupUserMocks({ multiSession: false });
  const { UserButton } = await import("~/components/user/user-button");

  render(<UserButton />);

  expect(screen.getByText("Settings")).toBeInTheDocument();
  expect(screen.queryByText("Switch account")).not.toBeInTheDocument();
  expect(screen.queryByTestId("switch-menu")).not.toBeInTheDocument();
});

test("hides the theme picker when themeToggle is false", async () => {
  setupUserMocks();
  const { UserButton } = await import("~/components/user/user-button");

  render(<UserButton themeToggle={false} />);

  expect(screen.getByText("Settings")).toBeInTheDocument();
  expect(screen.queryByText("Theme")).not.toBeInTheDocument();
});

test("hides the theme picker when theme, setTheme, or themes are missing", async () => {
  setupUserMocks({ appearance: { setTheme: null, theme: null, themes: [] } });
  const { UserButton } = await import("~/components/user/user-button");

  render(<UserButton />);

  expect(screen.getByText("Settings")).toBeInTheDocument();
  expect(screen.queryByText("Theme")).not.toBeInTheDocument();
});

test("renders only available theme triggers based on the themes array", async () => {
  setupUserMocks({
    appearance: {
      setTheme: vi.fn(),
      theme: "light",
      themes: ["light", "dark"],
    },
  });
  const { UserButton } = await import("~/components/user/user-button");

  render(<UserButton />);

  expect(screen.getByLabelText("Light")).toBeInTheDocument();
  expect(screen.getByLabelText("Dark")).toBeInTheDocument();
  expect(screen.queryByLabelText("System")).not.toBeInTheDocument();
});

test("renders sign-in and sign-up links when signed out", async () => {
  setupUserMocks({ session: null });
  const { UserButton } = await import("~/components/user/user-button");

  render(<UserButton />);

  const signIn = screen.getByText("Sign in").closest("a");
  const signUp = screen.getByText("Sign up").closest("a");
  expect(signIn).toHaveAttribute("href", "/auth/sign-in");
  expect(signUp).toHaveAttribute("href", "/auth/sign-up");
  expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
  expect(screen.queryByText("Settings")).not.toBeInTheDocument();
});

test("shows the user view in the trigger while setting an active session", async () => {
  setupUserMocks({
    pending: { setActiveSession: true },
    session: null,
  });
  const { UserButton } = await import("~/components/user/user-button");

  render(<UserButton />);

  expect(screen.queryByText("Account")).not.toBeInTheDocument();
});
