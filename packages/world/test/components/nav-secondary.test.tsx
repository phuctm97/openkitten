import { render, screen } from "@testing-library/react";
import { LifeBuoyIcon } from "lucide-react";
import { MemoryRouter } from "react-router";
import { expect, test } from "vitest";

import { NavSecondary } from "~/components/nav-secondary";
import { SidebarProvider } from "~/components/ui/sidebar";
import { TooltipProvider } from "~/components/ui/tooltip";

test("renders secondary navigation links", () => {
  render(
    <MemoryRouter>
      <TooltipProvider>
        <SidebarProvider>
          <NavSecondary
            className="secondary-nav"
            items={[
              {
                title: "Support",
                url: "/app",
                icon: <LifeBuoyIcon />,
              },
            ]}
          />
        </SidebarProvider>
      </TooltipProvider>
    </MemoryRouter>,
  );

  expect(screen.getByText("Support").closest("a")).toHaveAttribute(
    "href",
    "/app",
  );
  expect(document.querySelector('[data-slot="sidebar-group"]')).toHaveClass(
    "secondary-nav",
  );
});
