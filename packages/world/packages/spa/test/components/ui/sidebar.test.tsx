import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeIcon } from "lucide-react";
import type * as React from "react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "~/components/ui/sidebar";
import { TooltipProvider } from "~/components/ui/tooltip";

class StubResizeObserver implements ResizeObserver {
  disconnect() {}

  observe() {}

  unobserve() {}
}

type MatchMediaListener = (event: MediaQueryListEvent) => void;

function stubMobileViewport(isMobile: boolean) {
  const listeners = new Set<MatchMediaListener>();
  const width = isMobile ? 480 : 1024;

  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("matchMedia", (query: string) => {
    const mediaQueryList: MediaQueryList = {
      matches: isMobile,
      media: query,
      onchange: null,
      addEventListener: (
        _type: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        if (typeof listener === "function") {
          listeners.add(listener as MatchMediaListener);
        }
      },
      removeEventListener: (
        _type: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        if (typeof listener === "function") {
          listeners.delete(listener as MatchMediaListener);
        }
      },
      addListener: (listener: MatchMediaListener) => {
        listeners.add(listener);
      },
      removeListener: (listener: MatchMediaListener) => {
        listeners.delete(listener);
      },
      dispatchEvent: () => true,
    };

    return mediaQueryList;
  });
}

function getSlot(slot: string) {
  const element = document.querySelector(`[data-slot="${slot}"]`);

  if (!element) {
    throw new Error(`Missing slot ${slot}`);
  }

  return element;
}

function renderWithProvider(children: React.ReactNode) {
  return render(<TooltipProvider>{children}</TooltipProvider>);
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", StubResizeObserver);
});

test("throws when sidebar context is missing", () => {
  expect(() => render(<SidebarTrigger />)).toThrow(
    "useSidebar must be used within a SidebarProvider.",
  );
});

test("renders and toggles the desktop sidebar", async () => {
  stubMobileViewport(false);
  const user = userEvent.setup();

  renderWithProvider(
    <SidebarProvider
      className="provider-class"
      defaultOpen={false}
      style={{ color: "red" }}
    >
      <Sidebar
        className="sidebar-class"
        collapsible="icon"
        side="right"
        variant="floating"
      >
        <SidebarHeader>Top</SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Project</SidebarGroupLabel>
            <SidebarGroupLabel asChild>
              <a href="/project">Project Link</a>
            </SidebarGroupLabel>
            <SidebarGroupAction aria-label="Create">+</SidebarGroupAction>
            <SidebarGroupAction asChild>
              <a href="/create">Create Link</a>
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarInput placeholder="Search" />
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive tooltip="Home">
                    <HomeIcon />
                    <span>Home</span>
                  </SidebarMenuButton>
                  <SidebarMenuButton size="sm" tooltip={{ children: "Inbox" }}>
                    <span>Inbox</span>
                  </SidebarMenuButton>
                  <SidebarMenuButton asChild size="lg" variant="outline">
                    <a href="/settings">
                      <span>Settings</span>
                    </a>
                  </SidebarMenuButton>
                  <SidebarMenuAction showOnHover aria-label="Edit">
                    E
                  </SidebarMenuAction>
                  <SidebarMenuAction asChild>
                    <a href="/archive">Archive</a>
                  </SidebarMenuAction>
                  <SidebarMenuBadge>5</SidebarMenuBadge>
                  <SidebarMenuSkeleton showIcon />
                  <SidebarMenuSkeleton />
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton href="/daily" isActive size="sm">
                        Daily
                      </SidebarMenuSubButton>
                      <SidebarMenuSubButton asChild>
                        <a href="/weekly">Weekly</a>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>Bottom</SidebarFooter>
      </Sidebar>
      <SidebarInset>Main</SidebarInset>
      <SidebarTrigger />
      <SidebarRail />
    </SidebarProvider>,
  );

  expect(getSlot("sidebar-wrapper")).toHaveClass("provider-class");
  expect(getSlot("sidebar")).toHaveAttribute("data-state", "collapsed");
  expect(getSlot("sidebar")).toHaveAttribute("data-side", "right");
  expect(getSlot("sidebar")).toHaveAttribute("data-variant", "floating");
  expect(getSlot("sidebar-gap")).toBeInTheDocument();
  expect(getSlot("sidebar-container")).toHaveClass("sidebar-class");
  expect(getSlot("sidebar-inset")).toHaveTextContent("Main");
  expect(getSlot("sidebar-input")).toHaveAttribute("placeholder", "Search");
  expect(screen.getByRole("link", { name: "Project Link" })).toHaveAttribute(
    "data-slot",
    "sidebar-group-label",
  );
  expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
    "data-slot",
    "sidebar-menu-button",
  );
  expect(screen.getByRole("link", { name: "Archive" })).toHaveAttribute(
    "data-slot",
    "sidebar-menu-action",
  );
  expect(screen.getByRole("link", { name: "Weekly" })).toHaveAttribute(
    "data-slot",
    "sidebar-menu-sub-button",
  );
  expect(getSlot("sidebar-menu-badge")).toHaveTextContent("5");
  expect(
    document.querySelectorAll('[data-slot="sidebar-menu-skeleton"]'),
  ).toHaveLength(2);
  expect(
    document.querySelectorAll('[data-sidebar="menu-skeleton-icon"]'),
  ).toHaveLength(1);

  await user.click(getSlot("sidebar-trigger"));

  expect(getSlot("sidebar")).toHaveAttribute("data-state", "expanded");

  await user.keyboard("{Control>}b{/Control}");

  expect(getSlot("sidebar")).toHaveAttribute("data-state", "collapsed");

  await user.click(getSlot("sidebar-rail"));

  expect(getSlot("sidebar")).toHaveAttribute("data-state", "expanded");
});

test("uses controlled open state and stores it in local storage", async () => {
  stubMobileViewport(false);
  const onOpenChange = vi.fn();
  const user = userEvent.setup();

  renderWithProvider(
    <SidebarProvider open={false} onOpenChange={onOpenChange}>
      <Sidebar>
        <SidebarContent>Navigation</SidebarContent>
      </Sidebar>
      <SidebarTrigger onClick={onOpenChange} />
    </SidebarProvider>,
  );

  await user.click(getSlot("sidebar-trigger"));

  expect(onOpenChange).toHaveBeenCalledWith(
    expect.objectContaining({ type: "click" }),
  );
  expect(onOpenChange).toHaveBeenCalledWith(true);
  expect(localStorage.getItem("openkitten-sidebar-open")).toBe("true");
});

test("uses local storage as the uncontrolled initial sidebar state", () => {
  stubMobileViewport(false);
  localStorage.setItem("openkitten-sidebar-open", "false");

  renderWithProvider(
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarContent>Navigation</SidebarContent>
      </Sidebar>
    </SidebarProvider>,
  );

  expect(getSlot("sidebar")).toHaveAttribute("data-state", "collapsed");
});

test("renders a static sidebar when collapsing is disabled", () => {
  stubMobileViewport(false);

  renderWithProvider(
    <SidebarProvider>
      <Sidebar className="static-sidebar" collapsible="none">
        Static
      </Sidebar>
    </SidebarProvider>,
  );

  expect(getSlot("sidebar")).toHaveClass("static-sidebar");
  expect(getSlot("sidebar")).toHaveTextContent("Static");
});

test("renders mobile sidebar content in a sheet", async () => {
  stubMobileViewport(true);
  const user = userEvent.setup();

  function MobileState() {
    const { isMobile } = useSidebar();

    return <output>mobile:{String(isMobile)}</output>;
  }

  renderWithProvider(
    <SidebarProvider>
      <Sidebar side="left">
        <SidebarContent>Mobile Navigation</SidebarContent>
      </Sidebar>
      <MobileState />
      <SidebarTrigger />
    </SidebarProvider>,
  );

  await screen.findByText("mobile:true");

  await user.click(getSlot("sidebar-trigger"));

  await waitFor(() => {
    expect(
      document.body.querySelector('[data-mobile="true"]'),
    ).toHaveTextContent("Mobile Navigation");
  });
  expect(document.body.querySelector('[data-mobile="true"]')).toHaveAttribute(
    "data-side",
    "left",
  );
});

test("exposes sidebar state through the hook", async () => {
  stubMobileViewport(false);
  const user = userEvent.setup();

  function SidebarState() {
    const {
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    } = useSidebar();

    return (
      <>
        <output>
          {state}:{String(open)}:{String(isMobile)}:{String(openMobile)}
        </output>
        <button onClick={() => setOpen(true)} type="button">
          Open
        </button>
        <button onClick={() => setOpenMobile(true)} type="button">
          Open Mobile
        </button>
        <button onClick={toggleSidebar} type="button">
          Toggle
        </button>
      </>
    );
  }

  renderWithProvider(
    <SidebarProvider defaultOpen={false}>
      <SidebarState />
    </SidebarProvider>,
  );

  expect(screen.getByText("collapsed:false:false:false")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Open" }));

  expect(screen.getByText("expanded:true:false:false")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Open Mobile" }));

  expect(screen.getByText("expanded:true:false:true")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Toggle" }));

  expect(screen.getByText("collapsed:false:false:true")).toBeInTheDocument();
});
