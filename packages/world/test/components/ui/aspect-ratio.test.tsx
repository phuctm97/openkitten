import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { AspectRatio } from "~/components/ui/aspect-ratio";

test("renders an aspect ratio wrapper", () => {
  render(
    <AspectRatio ratio={16 / 9}>
      <img alt="House" src="/house.png" />
    </AspectRatio>,
  );

  expect(screen.getByAltText("House").parentElement).toHaveAttribute(
    "data-slot",
    "aspect-ratio",
  );
});
