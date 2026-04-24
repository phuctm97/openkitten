import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "~/components/ui/menubar";
import { getSlot } from "~/lib/get-slot";

test("renders an open menubar menu", () => {
  render(
    <Menubar value="file">
      <MenubarMenu value="file">
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarGroup>
            <MenubarLabel inset>File actions</MenubarLabel>
            <MenubarItem>Open</MenubarItem>
            <MenubarItem inset variant="destructive">
              Delete
              <MenubarShortcut>Cmd+D</MenubarShortcut>
            </MenubarItem>
            <MenubarCheckboxItem checked>Autosave</MenubarCheckboxItem>
            <MenubarRadioGroup value="one">
              <MenubarRadioItem value="one">One</MenubarRadioItem>
            </MenubarRadioGroup>
            <MenubarSeparator />
            <MenubarSub open>
              <MenubarSubTrigger>More</MenubarSubTrigger>
              <MenubarSubContent>Nested</MenubarSubContent>
            </MenubarSub>
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>,
  );

  expect(screen.getByRole("menubar")).toHaveAttribute("data-slot", "menubar");
  expect(screen.getByText("Delete")).toHaveAttribute(
    "data-variant",
    "destructive",
  );
  expect(getSlot("menubar-shortcut")).toHaveTextContent("Cmd+D");
});
