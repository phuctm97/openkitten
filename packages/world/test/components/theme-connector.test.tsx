import { render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { ThemeConnector } from "~/components/theme-connector";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test("applies the active color scheme to the document element", () => {
  localStorage.setItem("openkitten-theme", "dark");

  render(<ThemeConnector />);

  expect(document.documentElement).toHaveClass("dark");
  expect(document.documentElement.style.colorScheme).toBe("dark");
});

test("temporarily disables transitions while applying the color scheme", async () => {
  localStorage.setItem("openkitten-theme", "dark");
  const getComputedStyleSpy = vi.spyOn(window, "getComputedStyle");

  render(<ThemeConnector />);

  const temporaryStyle = Array.from(
    document.head.querySelectorAll("style"),
  ).find((style) => style.textContent?.includes("transition:none!important"));

  expect(temporaryStyle).toBeDefined();
  expect(getComputedStyleSpy).toHaveBeenCalledWith(document.body);

  await new Promise((resolve) => {
    setTimeout(resolve, 5);
  });

  expect(document.head.contains(temporaryStyle ?? null)).toBe(false);
});

test("removes the temporary transition style on unmount", () => {
  vi.useFakeTimers();
  localStorage.setItem("openkitten-theme", "dark");

  const { unmount } = render(<ThemeConnector />);

  const temporaryStyle = Array.from(
    document.head.querySelectorAll("style"),
  ).find((style) => style.textContent?.includes("transition:none!important"));

  expect(temporaryStyle).toBeDefined();

  unmount();

  expect(document.head.contains(temporaryStyle ?? null)).toBe(false);
});
