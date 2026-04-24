import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
  navigationMenuTriggerStyle,
} from "~/components/ui/navigation-menu";
import { getSlot } from "~/lib/get-slot";

test("renders navigation menu without viewport", () => {
  render(
    <NavigationMenu viewport={false}>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Menu</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLink href="/docs">Docs</NavigationMenuLink>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
      <NavigationMenuIndicator />
    </NavigationMenu>,
  );

  expect(getSlot("navigation-menu")).toHaveAttribute("data-viewport", "false");
  expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute(
    "data-slot",
    "navigation-menu-trigger",
  );
  expect(navigationMenuTriggerStyle()).toContain("navigation-menu-trigger");
});

test("renders navigation menu default viewport", () => {
  render(
    <NavigationMenu>
      <NavigationMenuList />
    </NavigationMenu>,
  );

  expect(getSlot("navigation-menu")).toHaveAttribute("data-viewport", "true");
  expect(NavigationMenuViewport({}).props.children.props).toMatchObject({
    "data-slot": "navigation-menu-viewport",
  });
  expect(
    NavigationMenuLink({ href: "/docs", children: "Docs" }).props,
  ).toMatchObject({
    "data-slot": "navigation-menu-link",
    href: "/docs",
  });
});
