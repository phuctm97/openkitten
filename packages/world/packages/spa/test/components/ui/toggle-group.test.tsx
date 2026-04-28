import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { getSlot } from "~/lib/get-slot";

test("renders toggle group context values", () => {
  render(
    <ToggleGroup type="single" variant="outline" size="sm" spacing={2}>
      <ToggleGroupItem value="left">Left</ToggleGroupItem>
      <ToggleGroupItem value="right">Right</ToggleGroupItem>
    </ToggleGroup>,
  );

  expect(getSlot("toggle-group")).toHaveAttribute("data-spacing", "2");
  expect(screen.getByRole("radio", { name: "Left" })).toHaveAttribute(
    "data-variant",
    "outline",
  );
  expect(screen.getByRole("radio", { name: "Left" })).toHaveAttribute(
    "data-size",
    "sm",
  );
});

test("renders toggle group defaults", () => {
  render(
    <ToggleGroup type="single">
      <ToggleGroupItem value="center">Center</ToggleGroupItem>
    </ToggleGroup>,
  );

  expect(getSlot("toggle-group")).toHaveAttribute("data-spacing", "0");
  expect(screen.getByRole("radio", { name: "Center" })).toHaveAttribute(
    "data-variant",
    "default",
  );
});
