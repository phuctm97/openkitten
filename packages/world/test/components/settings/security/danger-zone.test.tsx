import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { setupBetterAuthUiMocks } from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

test("renders the danger zone heading and delete action", async () => {
  setupBetterAuthUiMocks();
  vi.doMock("~/components/settings/security/delete-user", () => ({
    DeleteUser: () => <div data-testid="delete-user" />,
  }));
  const { DangerZone } = await import(
    "~/components/settings/security/danger-zone"
  );

  render(<DangerZone className="danger-zone" />);

  expect(screen.getByText("Danger zone")).toBeInTheDocument();
  expect(screen.getByTestId("delete-user")).toBeInTheDocument();
  expect(screen.getByText("Danger zone").closest("div")).toHaveClass(
    "danger-zone",
  );
});
