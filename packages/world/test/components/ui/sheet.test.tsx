import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";

test("renders sheet content with default close button", () => {
  render(
    <Sheet open>
      <SheetTrigger>Open Sheet</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Account</SheetTitle>
          <SheetDescription>Manage profile settings</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>,
  );

  expect(screen.getByText("Open Sheet")).toHaveAttribute(
    "data-slot",
    "sheet-trigger",
  );
  expect(
    document.body.querySelector('[data-slot="sheet-overlay"]'),
  ).not.toBeNull();
  expect(
    document.body.querySelector('[data-slot="sheet-content"]'),
  ).toHaveAttribute("data-side", "right");
  expect(screen.getByText("Account")).toHaveAttribute(
    "data-slot",
    "sheet-title",
  );
  expect(screen.getByText("Manage profile settings")).toHaveAttribute(
    "data-slot",
    "sheet-description",
  );
  expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
});

test("renders sheet sections with custom content props", () => {
  render(
    <Sheet open>
      <SheetContent
        className="custom-sheet"
        showCloseButton={false}
        side="left"
      >
        <SheetHeader className="custom-header">
          <SheetTitle className="custom-title">Navigation</SheetTitle>
          <SheetDescription className="custom-description">
            Pick a section
          </SheetDescription>
        </SheetHeader>
        <SheetFooter className="custom-footer">
          <SheetClose>Dismiss</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>,
  );

  expect(
    document.body.querySelector('[data-slot="sheet-content"]'),
  ).toHaveClass("custom-sheet");
  expect(
    document.body.querySelector('[data-slot="sheet-content"]'),
  ).toHaveAttribute("data-side", "left");
  expect(document.body.querySelector('[data-slot="sheet-header"]')).toHaveClass(
    "custom-header",
  );
  expect(screen.getByText("Navigation")).toHaveClass("custom-title");
  expect(screen.getByText("Pick a section")).toHaveClass("custom-description");
  expect(document.body.querySelector('[data-slot="sheet-footer"]')).toHaveClass(
    "custom-footer",
  );
  expect(screen.getByText("Dismiss")).toHaveAttribute(
    "data-slot",
    "sheet-close",
  );
  expect(
    screen.queryByRole("button", { name: "Close" }),
  ).not.toBeInTheDocument();
});
