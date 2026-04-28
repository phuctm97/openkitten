import { render } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { getSlot } from "~/lib/get-slot";

test("renders an open select", () => {
  render(
    <Select open defaultValue="cat">
      <SelectTrigger size="sm" aria-label="Animal">
        <SelectValue placeholder="Pick one" />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectGroup>
          <SelectLabel>Pets</SelectLabel>
          <SelectItem value="cat">Cat</SelectItem>
          <SelectSeparator />
          <SelectItem value="dog">Dog</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>,
  );

  expect(getSlot("select-trigger")).toHaveAttribute("data-size", "sm");
  expect(getSlot("select-content")).toHaveAttribute(
    "data-align-trigger",
    "false",
  );
  expect(getSlot("select-label")).toHaveTextContent("Pets");
});

test("renders default select trigger and aligned content", () => {
  render(
    <Select open defaultValue="cat">
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="cat">Cat</SelectItem>
      </SelectContent>
    </Select>,
  );

  expect(getSlot("select-trigger")).toHaveAttribute("data-size", "default");
  expect(getSlot("select-content")).toHaveAttribute(
    "data-align-trigger",
    "true",
  );
});
