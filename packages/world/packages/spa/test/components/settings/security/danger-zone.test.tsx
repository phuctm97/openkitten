import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  mockSonner,
  setupSettingsMocks,
} from "~/test/components/settings/mock-better-auth-ui-settings";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("renders the danger zone heading and DeleteUser child", async () => {
  mockSonner();
  setupSettingsMocks();
  vi.doMock("~/components/settings/security/delete-user", () => ({
    DeleteUser: () => <div data-testid="delete-user" />,
  }));
  const { DangerZone } = await import(
    "~/components/settings/security/danger-zone"
  );

  render(<DangerZone className="custom" />);

  expect(screen.getByText("Danger zone")).toBeInTheDocument();
  expect(screen.getByTestId("delete-user")).toBeInTheDocument();
});
