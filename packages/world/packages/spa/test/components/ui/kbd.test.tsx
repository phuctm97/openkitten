import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Kbd, KbdGroup } from "~/components/ui/kbd";

test("renders keyboard keys", () => {
  render(
    <KbdGroup>
      <Kbd>Cmd</Kbd>
      <Kbd>K</Kbd>
    </KbdGroup>,
  );

  expect(screen.getByText("Cmd")).toHaveAttribute("data-slot", "kbd");
  expect(screen.getByText("Cmd").parentElement).toHaveAttribute(
    "data-slot",
    "kbd-group",
  );
});
