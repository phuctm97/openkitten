import { useQuery } from "@tanstack/react-query";
import {
  CatIcon,
  InboxIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  MessageSquareIcon,
  NotebookPenIcon,
  ScaleIcon,
  TargetIcon,
} from "lucide-react";
import { Link, useMatch } from "react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "~/components/ui/sidebar";
import { UserButton } from "~/components/user/user-button";
import { orpcUtils } from "~/lib/orpc-utils";

type NavItem = {
  to: string;
  end: boolean;
  label: string;
  icon: LucideIcon;
  countKey?: "cats" | "goals" | "threads" | "notices" | "memos" | "rules";
};

const items: ReadonlyArray<NavItem> = [
  { to: "/app", end: true, label: "Overview", icon: LayoutDashboardIcon },
  {
    to: "/app/cats",
    end: false,
    label: "Cats",
    icon: CatIcon,
    countKey: "cats",
  },
  {
    to: "/app/goals",
    end: false,
    label: "Goals",
    icon: TargetIcon,
    countKey: "goals",
  },
  {
    to: "/app/threads",
    end: false,
    label: "Threads",
    icon: MessageSquareIcon,
    countKey: "threads",
  },
  {
    to: "/app/inbox",
    end: false,
    label: "Inbox",
    icon: InboxIcon,
    countKey: "notices",
  },
  {
    to: "/app/memos",
    end: false,
    label: "Memos",
    icon: NotebookPenIcon,
    countKey: "memos",
  },
  {
    to: "/app/rules",
    end: false,
    label: "Rules",
    icon: ScaleIcon,
    countKey: "rules",
  },
];

function NavMenuItem({
  item,
  badge,
}: {
  item: NavItem;
  badge: number | undefined;
}) {
  const match = useMatch({ path: item.to, end: item.end });
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={!!match} tooltip={item.label}>
        <Link to={item.to}>
          <Icon />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
      {badge ? <SidebarMenuBadge>{badge}</SidebarMenuBadge> : null}
    </SidebarMenuItem>
  );
}

export function AppSidebar({ houseName }: { houseName: string }) {
  const cats = useQuery(orpcUtils.cat.list.queryOptions());
  const goals = useQuery(orpcUtils.goal.list.queryOptions());
  const threads = useQuery(orpcUtils.thread.list.queryOptions());
  const notices = useQuery(orpcUtils.notice.list.queryOptions());
  const memos = useQuery(orpcUtils.memo.list.queryOptions());
  const rules = useQuery(orpcUtils.rule.list.queryOptions());

  const counts: Record<NonNullable<NavItem["countKey"]>, number | undefined> = {
    cats: cats.data?.length,
    goals: goals.data?.length,
    threads: threads.data?.filter((t) => t.status === "open").length,
    notices: notices.data?.filter((n) => n.readAt === null).length,
    memos: memos.data?.length,
    rules: rules.data?.filter((r) => r.enabled).length,
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip={houseName}
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link to="/">
                <span className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                  <CatIcon className="size-4" />
                </span>
                <div className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate font-heading text-sm">
                    {houseName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    OpenKitten World
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>House</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <NavMenuItem
                  key={item.to}
                  item={item}
                  badge={item.countKey ? counts[item.countKey] : undefined}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="gap-1">
        <UserButton
          className="w-full group-data-[collapsible=icon]:hidden"
          align="start"
        />
        <UserButton
          size="icon"
          className="hidden group-data-[collapsible=icon]:inline-flex"
        />
      </SidebarFooter>
    </Sidebar>
  );
}
