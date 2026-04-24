import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "~/components/ui/native-select";
import { getSlot } from "~/lib/get-slot";

test("renders native select slots", () => {
  render(
    <NativeSelect aria-label="Animal" size="sm" defaultValue="cat">
      <NativeSelectOptGroup label="Pets">
        <NativeSelectOption value="cat">Cat</NativeSelectOption>
      </NativeSelectOptGroup>
    </NativeSelect>,
  );

  expect(screen.getByLabelText("Animal")).toHaveAttribute("data-size", "sm");
  expect(getSlot("native-select-icon")).toHaveAttribute("aria-hidden", "true");
  expect(getSlot("native-select-option")).toHaveTextContent("Cat");
});

test("renders default native select size", () => {
  render(
    <NativeSelect aria-label="Default animal">
      <NativeSelectOption value="cat">Cat</NativeSelectOption>
    </NativeSelect>,
  );

  expect(screen.getByLabelText("Default animal")).toHaveAttribute(
    "data-size",
    "default",
  );
});
