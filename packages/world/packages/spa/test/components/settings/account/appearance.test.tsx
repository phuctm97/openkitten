import { fireEvent, render, screen } from "@testing-library/react";
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

test("renders all theme options and forwards onValueChange when authenticated", async () => {
  mockSonner();
  const setTheme = vi.fn();
  const mocks = setupSettingsMocks({
    auth: {
      appearance: {
        setTheme,
        theme: "light",
        themes: ["system", "light", "dark"],
      },
    },
  });
  const { Appearance } = await import(
    "~/components/settings/account/appearance"
  );

  render(<Appearance className="card" />);

  expect(screen.getByText("Appearance")).toBeInTheDocument();
  expect(screen.getByLabelText("System")).toBeInTheDocument();
  expect(screen.getByLabelText("Light")).toBeInTheDocument();
  expect(screen.getByLabelText("Dark")).toBeInTheDocument();
  expect(screen.getByTestId("theme-preview-system")).toBeInTheDocument();
  expect(screen.getByTestId("theme-preview-light")).toBeInTheDocument();
  expect(screen.getByTestId("theme-preview-dark")).toBeInTheDocument();

  fireEvent.click(screen.getByLabelText("Dark"));
  expect(mocks.auth.appearance.setTheme).toBe(setTheme);
  expect(setTheme).toHaveBeenCalledWith("dark");
});

test("hides theme options that are not in the configured list", async () => {
  mockSonner();
  setupSettingsMocks({
    auth: {
      appearance: { setTheme: vi.fn(), theme: "light", themes: ["light"] },
    },
  });
  const { Appearance } = await import(
    "~/components/settings/account/appearance"
  );

  render(<Appearance />);

  expect(screen.queryByLabelText("System")).toBeNull();
  expect(screen.queryByLabelText("Dark")).toBeNull();
  expect(screen.getByLabelText("Light")).toBeInTheDocument();
});

test("clears the radio value and propagates disabled when there is no session", async () => {
  mockSonner();
  setupSettingsMocks({ session: null });
  const { Appearance } = await import(
    "~/components/settings/account/appearance"
  );

  const { container } = render(<Appearance />);

  const radio = container.querySelector("[data-slot='radio-group']");
  expect(radio).not.toBeNull();
});

test("clears the theme to no value when theme is unset", async () => {
  mockSonner();
  setupSettingsMocks({
    auth: {
      appearance: {
        setTheme: vi.fn(),
        theme: null,
        themes: ["system", "light", "dark"],
      },
    },
  });
  const { Appearance } = await import(
    "~/components/settings/account/appearance"
  );

  render(<Appearance />);

  const systemRadio = screen.getByRole("radio", { name: /System/u });
  expect(systemRadio).toHaveAttribute("data-state", "unchecked");
});
