import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { ScrollArea, ScrollBar } from "~/components/ui/scroll-area";
import { getSlot } from "~/lib/get-slot";

test("renders scroll area and scrollbar orientations", () => {
  render(
    <ScrollArea>
      <div>Scrollable</div>
    </ScrollArea>,
  );

  expect(getSlot("scroll-area")).toBeInTheDocument();
  expect(screen.getByText("Scrollable")).toBeInTheDocument();

  expect(ScrollBar({ orientation: "horizontal" }).props).toMatchObject({
    "data-orientation": "horizontal",
    "data-slot": "scroll-area-scrollbar",
  });
  expect(ScrollBar({}).props).toMatchObject({
    "data-orientation": "vertical",
  });
});
