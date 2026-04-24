import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { getSlot } from "~/lib/get-slot";

test("renders an open alert dialog", () => {
  render(
    <AlertDialog open>
      <AlertDialogTrigger>Open</AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>!</AlertDialogMedia>
          <AlertDialogTitle>Delete item</AlertDialogTitle>
          <AlertDialogDescription>Confirm deletion</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>,
  );

  expect(getSlot("alert-dialog-content")).toHaveAttribute("data-size", "sm");
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Delete" })).toHaveAttribute(
    "data-slot",
    "alert-dialog-action",
  );
});

test("renders default alert dialog content size", () => {
  render(
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogTitle>Default size</AlertDialogTitle>
        <AlertDialogDescription>Default description</AlertDialogDescription>
      </AlertDialogContent>
    </AlertDialog>,
  );

  expect(getSlot("alert-dialog-content")).toHaveAttribute(
    "data-size",
    "default",
  );
});
