import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FrameIcon } from "lucide-react";
import { MemoryRouter } from "react-router";
import { expect, test, vi } from "vitest";

import { NavProjects } from "~/components/nav-projects";
import { SidebarProvider } from "~/components/ui/sidebar";
import { TooltipProvider } from "~/components/ui/tooltip";

function stubViewport(width: number) {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("matchMedia", (query: string) => {
    const mediaQueryList: MediaQueryList = {
      matches: width < 768,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: () => true,
    };

    return mediaQueryList;
  });
}

function renderNavProjects(width: number) {
  stubViewport(width);

  return render(
    <MemoryRouter>
      <TooltipProvider>
        <SidebarProvider>
          <NavProjects
            projects={[
              {
                name: "Design Engineering",
                url: "/app",
                icon: <FrameIcon />,
              },
            ]}
          />
        </SidebarProvider>
      </TooltipProvider>
    </MemoryRouter>,
  );
}

function getProjectMenuButton() {
  const button = screen.getAllByRole("button", { name: "More" })[0];

  if (!button) {
    throw new Error("Expected the project menu button to be rendered.");
  }

  return button;
}

test("renders project links and desktop action menu", async () => {
  const user = userEvent.setup();

  renderNavProjects(1024);

  expect(
    screen.getByRole("link", { name: "Design Engineering" }),
  ).toHaveAttribute("href", "/app");

  await user.click(getProjectMenuButton());

  expect(screen.getByRole("menuitem", { name: "View Project" })).toBeVisible();
  expect(screen.getByRole("menuitem", { name: "Share Project" })).toBeVisible();
  expect(
    screen.getByRole("menuitem", { name: "Delete Project" }),
  ).toBeVisible();
});

test("renders project action menu on mobile", async () => {
  const user = userEvent.setup();

  renderNavProjects(480);

  await screen.findByRole("link", { name: "Design Engineering" });
  await user.click(getProjectMenuButton());

  expect(screen.getByRole("menuitem", { name: "View Project" })).toBeVisible();
});
