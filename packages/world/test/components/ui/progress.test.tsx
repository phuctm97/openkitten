import { render } from "@testing-library/react";
import { expect, test } from "vitest";

import { Progress } from "~/components/ui/progress";
import { getSlot } from "~/lib/get-slot";

test("renders progress with and without value", () => {
  const { rerender } = render(<Progress value={35} />);

  expect(getSlot("progress-indicator")).toHaveStyle({
    transform: "translateX(-65%)",
  });

  rerender(<Progress />);

  expect(getSlot("progress-indicator")).toHaveStyle({
    transform: "translateX(-100%)",
  });
});
