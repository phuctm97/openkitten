import { render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";

type QueryName = "cat" | "goal" | "thread" | "notice" | "memo" | "rule";

const mocks = vi.hoisted(() => ({
  cat: undefined as unknown,
  goal: undefined as unknown,
  thread: undefined as unknown,
  notice: undefined as unknown,
  memo: undefined as unknown,
  rule: undefined as unknown,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (options: { queryKey: [QueryName, string] }) => {
      const [name] = options.queryKey;
      return { data: mocks[name] };
    },
  };
});

vi.mock("~/lib/orpc-utils", () => {
  const make = (name: QueryName) => ({
    list: { queryOptions: () => ({ queryKey: [name, "list"] }) },
  });
  return {
    orpcUtils: {
      cat: make("cat"),
      goal: make("goal"),
      thread: make("thread"),
      notice: make("notice"),
      memo: make("memo"),
      rule: make("rule"),
    },
  };
});

vi.mock("~/components/user/user-button", () => ({
  UserButton: () => <div data-testid="user-button" />,
}));

vi.mock("~/components/ui/sidebar", () => {
  const stub = (slot: string) => {
    const Component = ({
      children,
      ...rest
    }: { children?: ReactNode } & Record<string, unknown>) => (
      <div data-slot={slot} {...(rest as ComponentProps<"div">)}>
        {children}
      </div>
    );
    return Component;
  };
  function SidebarMenuButton({
    children,
    isActive,
    asChild: _asChild,
    tooltip: _tooltip,
    ...rest
  }: {
    children?: ReactNode;
    isActive?: boolean;
    asChild?: boolean;
    tooltip?: string;
  } & ComponentProps<"div">) {
    return (
      <div
        data-slot="sidebar-menu-button"
        data-active={isActive ? "true" : "false"}
        {...rest}
      >
        {children}
      </div>
    );
  }
  return {
    Sidebar: stub("sidebar"),
    SidebarContent: stub("sidebar-content"),
    SidebarFooter: stub("sidebar-footer"),
    SidebarGroup: stub("sidebar-group"),
    SidebarGroupContent: stub("sidebar-group-content"),
    SidebarGroupLabel: stub("sidebar-group-label"),
    SidebarHeader: stub("sidebar-header"),
    SidebarMenu: stub("sidebar-menu"),
    SidebarMenuBadge: stub("sidebar-menu-badge"),
    SidebarMenuButton,
    SidebarMenuItem: stub("sidebar-menu-item"),
    SidebarSeparator: stub("sidebar-separator"),
  };
});

afterEach(() => {
  mocks.cat = undefined;
  mocks.goal = undefined;
  mocks.thread = undefined;
  mocks.notice = undefined;
  mocks.memo = undefined;
  mocks.rule = undefined;
});

function renderWithRouter(initial: string, ui: ReactNode) {
  return render(<MemoryRouter initialEntries={[initial]}>{ui}</MemoryRouter>);
}

test("renders the house header and all nav items", async () => {
  const { AppSidebar } = await import("~/lib/app-sidebar");
  renderWithRouter("/app", <AppSidebar houseName="Acme" />);
  expect(screen.getByText("Acme")).toBeInTheDocument();
  expect(screen.getByText("OpenKitten World")).toBeInTheDocument();
  expect(screen.getByText("Overview")).toBeInTheDocument();
  expect(screen.getByText("Cats")).toBeInTheDocument();
  expect(screen.getByText("Goals")).toBeInTheDocument();
  expect(screen.getByText("Threads")).toBeInTheDocument();
  expect(screen.getByText("Inbox")).toBeInTheDocument();
  expect(screen.getByText("Memos")).toBeInTheDocument();
  expect(screen.getByText("Rules")).toBeInTheDocument();
});

test("renders badges with counts derived from queries", async () => {
  mocks.cat = [{}, {}, {}];
  mocks.goal = [{}];
  mocks.thread = [{ status: "open" }, { status: "open" }, { status: "closed" }];
  mocks.notice = [{ readAt: null }, { readAt: new Date() }];
  mocks.memo = [{}, {}, {}, {}];
  mocks.rule = [{ enabled: true }, { enabled: false }, { enabled: true }];

  const { AppSidebar } = await import("~/lib/app-sidebar");
  const { container } = renderWithRouter("/app", <AppSidebar houseName="X" />);
  const badges = container.querySelectorAll('[data-slot="sidebar-menu-badge"]');
  const texts = Array.from(badges).map((b) => b.textContent);
  expect(texts).toEqual(["3", "1", "2", "1", "4", "2"]);
});
