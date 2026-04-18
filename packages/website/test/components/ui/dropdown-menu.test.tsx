import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

test("renders dropdown menu primitives and variants", () => {
  const { container } = render(
    <DropdownMenu open>
      <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
      <DropdownMenuPortal>
        <div data-testid="dropdown-menu-portal-child" />
      </DropdownMenuPortal>
      <DropdownMenuContent forceMount>
        <DropdownMenuLabel inset>House Actions</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuItem inset variant="destructive">
            Delete Save
            <DropdownMenuShortcut>Del</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem checked inset>
            Notifications
          </DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup value="cat">
            <DropdownMenuRadioItem inset value="cat">
              Cat
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub open>
          <DropdownMenuSubTrigger inset>More</DropdownMenuSubTrigger>
          <DropdownMenuSubContent forceMount>
            <DropdownMenuItem>Archive</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>,
  );

  expect(
    container.querySelector('[data-slot="dropdown-menu-trigger"]'),
  ).toHaveTextContent("Open Menu");
  expect(screen.getByTestId("dropdown-menu-portal-child")).toBeInTheDocument();
  expect(
    screen
      .getByText("House Actions")
      .closest('[data-slot="dropdown-menu-label"]'),
  ).toHaveAttribute("data-inset", "true");
  expect(
    screen.getByText("Profile").closest('[data-slot="dropdown-menu-item"]'),
  ).toHaveAttribute("data-variant", "default");
  expect(
    screen.getByText("Delete Save").closest('[data-slot="dropdown-menu-item"]'),
  ).toHaveAttribute("data-variant", "destructive");
  expect(screen.getByText("Del")).toHaveAttribute(
    "data-slot",
    "dropdown-menu-shortcut",
  );
  expect(
    screen.getByRole("menuitemcheckbox", { name: "Notifications" }),
  ).toHaveAttribute("data-slot", "dropdown-menu-checkbox-item");
  expect(screen.getByRole("menuitemradio", { name: "Cat" })).toHaveAttribute(
    "data-slot",
    "dropdown-menu-radio-item",
  );
  expect(
    document.body.querySelector('[data-slot="dropdown-menu-radio-group"]'),
  ).not.toBeNull();
  expect(
    document.body.querySelector('[data-slot="dropdown-menu-separator"]'),
  ).not.toBeNull();
  expect(
    screen.getByText("More").closest('[data-slot="dropdown-menu-sub-trigger"]'),
  ).toHaveAttribute("data-inset", "true");
  expect(screen.getByText("Archive")).toHaveAttribute(
    "data-slot",
    "dropdown-menu-item",
  );
  expect(
    document.body.querySelector('[data-slot="dropdown-menu-sub-content"]'),
  ).not.toBeNull();
});
