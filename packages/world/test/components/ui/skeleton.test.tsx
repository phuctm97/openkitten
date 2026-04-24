import { render } from "@testing-library/react";
import { expect, test } from "vitest";

import { Skeleton } from "~/components/ui/skeleton";
import { getSlot } from "~/lib/get-slot";

test("renders skeleton slot", () => {
  render(<Skeleton className="h-4 w-20" />);

  expect(getSlot("skeleton")).toHaveClass("h-4");
});
