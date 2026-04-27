import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { NavUser } from "~/components/nav-user";
import { SidebarProvider } from "~/components/ui/sidebar";

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

function renderNavUser(width: number) {
  stubViewport(width);

  return render(
    <SidebarProvider>
      <NavUser
        user={{
          name: "shadcn",
          email: "m@example.com",
          avatar: "/avatars/shadcn.jpg",
        }}
      />
    </SidebarProvider>,
  );
}

test("renders the user menu on desktop", async () => {
  const user = userEvent.setup();

  renderNavUser(1024);

  await user.click(screen.getByRole("button", { name: /shadcn/i }));

  expect(
    screen.getByRole("menuitem", { name: "Upgrade to Pro" }),
  ).toBeVisible();
  expect(screen.getByRole("menuitem", { name: "Account" })).toBeVisible();
  expect(screen.getByRole("menuitem", { name: "Billing" })).toBeVisible();
  expect(screen.getByRole("menuitem", { name: "Notifications" })).toBeVisible();
  expect(screen.getByRole("menuitem", { name: "Log out" })).toBeVisible();
});

test("renders the user menu on mobile", async () => {
  const user = userEvent.setup();

  renderNavUser(480);

  await user.click(screen.getByRole("button", { name: /shadcn/i }));

  expect(screen.getByRole("menuitem", { name: "Account" })).toBeVisible();
});
