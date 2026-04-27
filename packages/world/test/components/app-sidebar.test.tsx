import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, test } from "vitest";

import { AppSidebar } from "~/components/app-sidebar";
import { SidebarProvider } from "~/components/ui/sidebar";
import { TooltipProvider } from "~/components/ui/tooltip";

test("renders the block sidebar navigation", () => {
  render(
    <MemoryRouter>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </TooltipProvider>
    </MemoryRouter>,
  );

  expect(screen.getByRole("link", { name: /acme inc/i })).toHaveAttribute(
    "href",
    "/app",
  );
  expect(screen.getByText("Platform")).toBeInTheDocument();
  expect(screen.getByText("Projects")).toBeInTheDocument();
  expect(screen.getByText("shadcn")).toBeInTheDocument();
});
