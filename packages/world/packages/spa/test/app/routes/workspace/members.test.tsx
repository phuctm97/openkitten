import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("react-router", () => ({
  useOutletContext: () => ({ organizationId: "org_1" }),
}));

vi.mock("~/components/auth/organization-members-card", () => ({
  OrganizationMembersCard: ({ organizationId }: { organizationId: string }) => (
    <div data-testid="members-card" data-org={organizationId} />
  ),
}));

vi.mock("~/components/auth/organization-invitations-card", () => ({
  OrganizationInvitationsCard: ({
    organizationId,
  }: {
    organizationId: string;
  }) => <div data-testid="invitations-card" data-org={organizationId} />,
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

test("renders members and invitations cards using the outlet context organizationId", async () => {
  const { default: Component } = await import("~/app/routes/workspace/members");

  render(<Component />);

  expect(screen.getByTestId("members-card")).toHaveAttribute(
    "data-org",
    "org_1",
  );
  expect(screen.getByTestId("invitations-card")).toHaveAttribute(
    "data-org",
    "org_1",
  );
});
