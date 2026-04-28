import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

class StubResizeObserver implements ResizeObserver {
  disconnect() {}

  observe() {}

  unobserve() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", StubResizeObserver);
});

test("renders tooltip primitives with defaults", () => {
  const { container } = render(
    <TooltipProvider>
      <Tooltip open>
        <TooltipTrigger>Inspect</TooltipTrigger>
        <TooltipContent>More detail</TooltipContent>
      </Tooltip>
    </TooltipProvider>,
  );

  expect(container.querySelector('[data-slot="tooltip"]')).toBeNull();
  expect(screen.getByText("Inspect")).toHaveAttribute(
    "data-slot",
    "tooltip-trigger",
  );
  expect(
    document.body.querySelector('[data-slot="tooltip-content"]'),
  ).toHaveTextContent("More detail");
});

test("renders tooltip content with custom props", () => {
  render(
    <TooltipProvider delayDuration={200}>
      <Tooltip open>
        <TooltipTrigger>Configure</TooltipTrigger>
        <TooltipContent className="custom-tooltip" sideOffset={8}>
          Custom detail
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>,
  );

  expect(
    document.body.querySelector('[data-slot="tooltip-content"]'),
  ).toHaveClass("custom-tooltip");
});
