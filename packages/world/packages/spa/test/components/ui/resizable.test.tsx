import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "~/components/ui/resizable";
import { getSlot } from "~/lib/get-slot";

test("renders resizable panels and handle", () => {
  render(
    <ResizablePanelGroup orientation="horizontal">
      <ResizablePanel>Left</ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel>Right</ResizablePanel>
    </ResizablePanelGroup>,
  );

  expect(getSlot("resizable-panel-group")).toBeInTheDocument();
  expect(screen.getByText("Left")).toBeInTheDocument();
  expect(
    document.querySelectorAll('[data-slot="resizable-panel"]'),
  ).toHaveLength(2);
  expect(getSlot("resizable-handle").firstElementChild).toBeInTheDocument();
});
