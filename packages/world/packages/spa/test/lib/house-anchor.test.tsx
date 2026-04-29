import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, test, vi } from "vitest";
import { HouseAnchor } from "~/lib/house-anchor";

vi.mock("~/components/auth/organization-switcher", () => ({
  OrganizationSwitcher: ({ className }: { className?: string }) => (
    <div data-testid="switcher" data-class={className} />
  ),
}));

test("renders the house anchor with the org switcher and a settings link to /workspace/settings", () => {
  render(
    <MemoryRouter>
      <HouseAnchor />
    </MemoryRouter>,
  );

  expect(screen.getByTestId("switcher")).toBeInTheDocument();
  const link = screen.getByRole("link", { name: "Open house settings" });
  expect(link).toHaveAttribute("href", "/workspace/settings");
});
