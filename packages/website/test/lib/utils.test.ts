import { expect, test } from "vitest";

import { cn } from "~/lib/utils";

test("filters falsy values and merges conflicting tailwind classes", () => {
  expect(cn("px-2", undefined, false, ["font-mono", "px-4"])).toBe(
    "font-mono px-4",
  );
});
