import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { setupBetterAuthUiMocks } from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

test("renders all configured theme options and updates the selected theme", async () => {
  const mocks = setupBetterAuthUiMocks();
  const { Appearance } = await import(
    "~/components/settings/account/appearance"
  );

  render(<Appearance />);

  expect(screen.getByText("Appearance")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
  expect(mocks.auth.appearance.setTheme).toHaveBeenCalledWith("dark");
  expect(screen.getByTestId("theme-preview-system")).toBeInTheDocument();
  expect(screen.getByTestId("theme-preview-light")).toBeInTheDocument();
  expect(screen.getByTestId("theme-preview-dark")).toBeInTheDocument();
});

test("disables theme selection when no session is available", async () => {
  setupBetterAuthUiMocks({
    session: null,
  });
  const { Appearance } = await import(
    "~/components/settings/account/appearance"
  );

  render(<Appearance />);

  expect(screen.getByRole("radiogroup")).toHaveAttribute("data-disabled");
});
