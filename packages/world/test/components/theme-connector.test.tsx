import { render } from "@testing-library/react";
import { expect, test } from "vitest";

import { ThemeConnector } from "~/components/theme-connector";

test("applies the active color scheme to the document element", () => {
  localStorage.setItem("openkitten-theme", "dark");

  render(<ThemeConnector />);

  expect(document.documentElement).toHaveClass("dark");
  expect(document.documentElement.style.colorScheme).toBe("dark");
});
