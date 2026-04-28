import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";

test("renders collapsible primitives", () => {
  render(
    <Collapsible open>
      <CollapsibleTrigger>Toggle</CollapsibleTrigger>
      <CollapsibleContent>Details</CollapsibleContent>
    </Collapsible>,
  );

  expect(screen.getByText("Toggle")).toHaveAttribute(
    "data-slot",
    "collapsible-trigger",
  );
  expect(screen.getByText("Details")).toHaveAttribute(
    "data-slot",
    "collapsible-content",
  );
  expect(screen.getByText("Details").parentElement).toHaveAttribute(
    "data-slot",
    "collapsible",
  );
});
