import {
  BookOpenIcon,
  BotIcon,
  FrameIcon,
  LifeBuoyIcon,
  MapIcon,
  PieChartIcon,
  SendIcon,
  Settings2Icon,
  TerminalIcon,
  TerminalSquareIcon,
} from "lucide-react";
import type * as React from "react";
import { Link } from "react-router";
import { NavMain } from "~/components/nav-main";
import { NavProjects } from "~/components/nav-projects";
import { NavSecondary } from "~/components/nav-secondary";
import { NavUser } from "~/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar";

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Playground",
      url: "/app",
      icon: <TerminalSquareIcon />,
      isActive: true,
      items: [
        {
          title: "History",
          url: "/app",
        },
        {
          title: "Starred",
          url: "/app",
        },
        {
          title: "Settings",
          url: "/app",
        },
      ],
    },
    {
      title: "Models",
      url: "/app",
      icon: <BotIcon />,
      items: [
        {
          title: "Genesis",
          url: "/app",
        },
        {
          title: "Explorer",
          url: "/app",
        },
        {
          title: "Quantum",
          url: "/app",
        },
      ],
    },
    {
      title: "Documentation",
      url: "/app",
      icon: <BookOpenIcon />,
      items: [
        {
          title: "Introduction",
          url: "/app",
        },
        {
          title: "Get Started",
          url: "/app",
        },
        {
          title: "Tutorials",
          url: "/app",
        },
        {
          title: "Changelog",
          url: "/app",
        },
      ],
    },
    {
      title: "Settings",
      url: "/app",
      icon: <Settings2Icon />,
      items: [
        {
          title: "General",
          url: "/app",
        },
        {
          title: "Team",
          url: "/app",
        },
        {
          title: "Billing",
          url: "/app",
        },
        {
          title: "Limits",
          url: "/app",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Support",
      url: "/app",
      icon: <LifeBuoyIcon />,
    },
    {
      title: "Feedback",
      url: "/app",
      icon: <SendIcon />,
    },
  ],
  projects: [
    {
      name: "Design Engineering",
      url: "/app",
      icon: <FrameIcon />,
    },
    {
      name: "Sales & Marketing",
      url: "/app",
      icon: <PieChartIcon />,
    },
    {
      name: "Travel",
      url: "/app",
      icon: <MapIcon />,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/app">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <TerminalIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Acme Inc</span>
                  <span className="truncate text-xs">Enterprise</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
