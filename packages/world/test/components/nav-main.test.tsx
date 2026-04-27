import { render, screen } from "@testing-library/react";
import { TerminalSquareIcon } from "lucide-react";
import { MemoryRouter } from "react-router";
import { expect, test } from "vitest";

import { NavMain } from "~/components/nav-main";
import { SidebarProvider } from "~/components/ui/sidebar";
import { TooltipProvider } from "~/components/ui/tooltip";

test("renders expandable and flat main navigation items", () => {
  render(
    <MemoryRouter>
      <TooltipProvider>
        <SidebarProvider>
          <NavMain
            items={[
              {
                title: "Playground",
                url: "/app",
                icon: <TerminalSquareIcon />,
                isActive: true,
                items: [{ title: "History", url: "/app" }],
              },
              {
                title: "Models",
                url: "/app",
                icon: <TerminalSquareIcon />,
              },
            ]}
          />
        </SidebarProvider>
      </TooltipProvider>
    </MemoryRouter>,
  );

  expect(screen.getByRole("link", { name: "Playground" })).toHaveAttribute(
    "href",
    "/app",
  );
  expect(screen.getByRole("link", { name: "History" })).toHaveAttribute(
    "data-slot",
    "sidebar-menu-sub-button",
  );
  expect(screen.getByRole("link", { name: "Models" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Toggle" })).toBeInTheDocument();
});
