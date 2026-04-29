import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("react-router", () => ({
  useOutletContext: () => ({ organizationId: "org_1" }),
}));

vi.mock("~/components/auth/organization-name-card", () => ({
  OrganizationNameCard: ({ organizationId }: { organizationId: string }) => (
    <div data-testid="name-card" data-org={organizationId} />
  ),
}));

vi.mock("~/components/auth/organization-slug-card", () => ({
  OrganizationSlugCard: ({ organizationId }: { organizationId: string }) => (
    <div data-testid="slug-card" data-org={organizationId} />
  ),
}));

vi.mock("~/components/auth/delete-organization-card", () => ({
  DeleteOrganizationCard: ({ organizationId }: { organizationId: string }) => (
    <div data-testid="delete-card" data-org={organizationId} />
  ),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

test("renders the three settings cards using the outlet context organizationId", async () => {
  const { default: Component } = await import(
    "~/app/routes/workspace/settings"
  );

  render(<Component />);

  expect(screen.getByTestId("name-card")).toHaveAttribute("data-org", "org_1");
  expect(screen.getByTestId("slug-card")).toHaveAttribute("data-org", "org_1");
  expect(screen.getByTestId("delete-card")).toHaveAttribute(
    "data-org",
    "org_1",
  );
});
