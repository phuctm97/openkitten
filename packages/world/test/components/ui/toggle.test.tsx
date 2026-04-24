import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Toggle, toggleVariants } from "~/components/ui/toggle";

test("renders toggle and exposes variants", () => {
  render(
    <Toggle variant="outline" size="lg" aria-label="Bold" pressed>
      B
    </Toggle>,
  );

  expect(screen.getByRole("button", { name: "Bold" })).toHaveAttribute(
    "data-slot",
    "toggle",
  );
  expect(toggleVariants({ variant: "outline", size: "sm" })).toContain("h-8");
});

test("renders default toggle variants", () => {
  render(<Toggle aria-label="Italic">I</Toggle>);

  expect(screen.getByRole("button", { name: "Italic" })).toHaveAttribute(
    "data-slot",
    "toggle",
  );
  expect(toggleVariants()).toContain("h-9");
});
