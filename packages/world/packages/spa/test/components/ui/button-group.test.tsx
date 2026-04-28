import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Button } from "~/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "~/components/ui/button-group";
import { getSlot } from "~/lib/get-slot";

test("renders button group slots and child text", () => {
  render(
    <ButtonGroup orientation="vertical">
      <Button>One</Button>
      <ButtonGroupSeparator />
      <ButtonGroupText asChild>
        <span>Label</span>
      </ButtonGroupText>
    </ButtonGroup>,
  );

  expect(screen.getByRole("group")).toHaveAttribute(
    "data-orientation",
    "vertical",
  );
  expect(getSlot("button-group-separator")).toHaveAttribute(
    "data-orientation",
    "vertical",
  );
  expect(screen.getByText("Label")).toBeInTheDocument();
});

test("renders default button group text", () => {
  render(
    <ButtonGroup>
      <ButtonGroupText>Plain label</ButtonGroupText>
    </ButtonGroup>,
  );

  expect(screen.getByText("Plain label")).toBeInTheDocument();
});
