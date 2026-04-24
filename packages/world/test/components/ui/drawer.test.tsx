import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { getSlot } from "~/lib/get-slot";

test("renders an open drawer", () => {
  render(
    <Drawer open>
      <DrawerTrigger>Open</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Drawer title</DrawerTitle>
          <DrawerDescription>Drawer description</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <DrawerClose>Close</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>,
  );

  expect(getSlot("drawer-content")).toBeInTheDocument();
  expect(screen.getByText("Drawer title")).toHaveAttribute(
    "data-slot",
    "drawer-title",
  );
});
