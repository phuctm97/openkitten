import { render, screen } from "@testing-library/react";
import { UserIcon } from "lucide-react";
import { expect, test } from "vitest";

import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "~/components/ui/item";
import { getSlot } from "~/lib/get-slot";

test("renders item slots and variants", () => {
  render(
    <ItemGroup>
      <Item asChild size="xs" variant="outline">
        <a href="/profile">
          <ItemHeader>Header</ItemHeader>
          <ItemMedia variant="icon">
            <UserIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Profile</ItemTitle>
            <ItemDescription>Manage account</ItemDescription>
          </ItemContent>
          <ItemActions>Actions</ItemActions>
          <ItemFooter>Footer</ItemFooter>
        </a>
      </Item>
      <ItemSeparator />
    </ItemGroup>,
  );

  expect(screen.getByRole("list")).toHaveAttribute("data-slot", "item-group");
  expect(screen.getByRole("link", { name: /Profile/ })).toHaveAttribute(
    "data-size",
    "xs",
  );
  expect(getSlot("item-media")).toHaveAttribute("data-variant", "icon");
  expect(getSlot("item-separator")).toBeInTheDocument();
});

test("renders default and image item variants", () => {
  render(
    <Item>
      <ItemMedia>Media</ItemMedia>
      <ItemMedia variant="image">
        <img alt="Avatar" src="/avatar.png" />
      </ItemMedia>
      <ItemTitle>Default item</ItemTitle>
    </Item>,
  );

  expect(getSlot("item")).toHaveAttribute("data-variant", "default");
  expect(screen.getByAltText("Avatar").parentElement).toHaveAttribute(
    "data-variant",
    "image",
  );
});
