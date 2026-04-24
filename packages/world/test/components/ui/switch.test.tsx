import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Switch } from "~/components/ui/switch";

test("renders switch sizes", () => {
  render(<Switch size="sm" aria-label="Enabled" defaultChecked />);

  expect(screen.getByRole("switch", { name: "Enabled" })).toHaveAttribute(
    "data-size",
    "sm",
  );
  expect(
    screen.getByRole("switch", { name: "Enabled" }).firstElementChild,
  ).toHaveAttribute("data-slot", "switch-thumb");
});

test("renders default switch size", () => {
  render(<Switch aria-label="Default enabled" />);

  expect(
    screen.getByRole("switch", { name: "Default enabled" }),
  ).toHaveAttribute("data-size", "default");
});
