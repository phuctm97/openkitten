import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "~/components/ui/popover";
import { getSlot } from "~/lib/get-slot";

test("renders an open popover", () => {
  render(
    <Popover open>
      <PopoverAnchor>Anchor</PopoverAnchor>
      <PopoverTrigger>Open</PopoverTrigger>
      <PopoverContent align="start">
        <PopoverHeader>
          <PopoverTitle>Title</PopoverTitle>
          <PopoverDescription>Description</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>,
  );

  expect(screen.getByText("Open")).toHaveAttribute(
    "data-slot",
    "popover-trigger",
  );
  expect(getSlot("popover-title")).toHaveTextContent("Title");
});

test("renders popover content defaults", () => {
  render(
    <Popover open>
      <PopoverTrigger>Default open</PopoverTrigger>
      <PopoverContent>Default content</PopoverContent>
    </Popover>,
  );

  expect(getSlot("popover-content")).toHaveTextContent("Default content");
});
