import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Label } from "~/components/ui/label";

test("renders an accessible label", () => {
  render(
    <>
      <input id="display-name" />
      <Label htmlFor="display-name">Display name</Label>
    </>,
  );

  expect(screen.getByText("Display name")).toHaveAttribute(
    "data-slot",
    "label",
  );
  expect(screen.getByText("Display name")).toHaveAttribute(
    "for",
    "display-name",
  );
});
