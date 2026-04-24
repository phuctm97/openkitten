import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { getSlot } from "~/lib/get-slot";

test("renders accordion slots", () => {
  render(
    <Accordion type="single" collapsible>
      <AccordionItem value="daily">
        <AccordionTrigger>Daily</AccordionTrigger>
        <AccordionContent>Report</AccordionContent>
      </AccordionItem>
    </Accordion>,
  );

  expect(getSlot("accordion")).toBeInTheDocument();
  expect(getSlot("accordion-item")).toHaveAttribute("data-slot");
  expect(screen.getByRole("button", { name: "Daily" })).toHaveAttribute(
    "data-slot",
    "accordion-trigger",
  );
});
