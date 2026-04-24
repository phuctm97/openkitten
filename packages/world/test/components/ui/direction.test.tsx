import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { DirectionProvider, useDirection } from "~/components/ui/direction";

function DirectionProbe() {
  return <div>Direction: {useDirection()}</div>;
}

test("provides direction from direction prop", () => {
  render(
    <DirectionProvider dir="ltr" direction="rtl">
      <DirectionProbe />
    </DirectionProvider>,
  );

  expect(screen.getByText("Direction: rtl")).toBeInTheDocument();
});

test("falls back to dir prop", () => {
  render(
    <DirectionProvider dir="ltr">
      <DirectionProbe />
    </DirectionProvider>,
  );

  expect(screen.getByText("Direction: ltr")).toBeInTheDocument();
});
