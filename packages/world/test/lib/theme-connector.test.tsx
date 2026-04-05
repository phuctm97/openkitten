import { render } from "@testing-library/react";
import { expect, test } from "vitest";

import { ThemeConnector } from "~/lib/theme-connector";

test("applies the active color scheme to the document element", () => {
  localStorage.setItem("openkitten-world-theme", "dark");

  render(<ThemeConnector />);

  expect(document.documentElement).toHaveClass("dark");
  expect(document.documentElement.style.colorScheme).toBe("dark");
});
