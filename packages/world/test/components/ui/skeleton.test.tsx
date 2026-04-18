import { render } from "@testing-library/react";
import { expect, test } from "vitest";

import { Skeleton } from "~/components/ui/skeleton";

test("renders a skeleton placeholder", () => {
  const { container } = render(<Skeleton className="size-4 rounded-full" />);

  expect(container.querySelector('[data-slot="skeleton"]')).toHaveClass(
    "size-4",
    "rounded-full",
  );
});
