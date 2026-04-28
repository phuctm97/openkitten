import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Checkbox } from "~/components/ui/checkbox";

test("renders a checked checkbox with its indicator", () => {
  render(<Checkbox aria-label="Accept updates" defaultChecked />);

  const checkbox = screen.getByRole("checkbox", { name: "Accept updates" });

  expect(checkbox).toHaveAttribute("data-slot", "checkbox");
  expect(checkbox).toHaveAttribute("data-state", "checked");
  expect(
    checkbox.querySelector('[data-slot="checkbox-indicator"]'),
  ).not.toBeNull();
});
