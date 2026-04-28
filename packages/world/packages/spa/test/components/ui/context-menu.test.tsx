import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "~/components/ui/context-menu";
import { getSlot } from "~/lib/get-slot";

test("renders an open context menu", async () => {
  render(
    <ContextMenu>
      <ContextMenuTrigger>Target</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuGroup>
          <ContextMenuLabel inset>Menu</ContextMenuLabel>
          <ContextMenuItem>Open</ContextMenuItem>
          <ContextMenuItem inset variant="destructive">
            Delete
            <ContextMenuShortcut>Cmd+D</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuCheckboxItem checked>Checked</ContextMenuCheckboxItem>
          <ContextMenuRadioGroup value="one">
            <ContextMenuRadioItem value="one">One</ContextMenuRadioItem>
          </ContextMenuRadioGroup>
          <ContextMenuSeparator />
          <ContextMenuSub open>
            <ContextMenuSubTrigger>More</ContextMenuSubTrigger>
            <ContextMenuSubContent>Sub item</ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>,
  );

  expect(screen.getByText("Target")).toHaveAttribute(
    "data-slot",
    "context-menu-trigger",
  );
  fireEvent.contextMenu(screen.getByText("Target"));
  await waitFor(() =>
    expect(screen.getByText("Delete")).toHaveAttribute(
      "data-variant",
      "destructive",
    ),
  );
  expect(getSlot("context-menu-shortcut")).toHaveTextContent("Cmd+D");
});

test("renders context menu portal wrapper", () => {
  const element = ContextMenuPortal({ children: "Portal content" });

  expect(element.props).toMatchObject({
    "data-slot": "context-menu-portal",
    children: "Portal content",
  });
});
