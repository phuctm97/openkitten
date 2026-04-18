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
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";

test("renders alert dialog primitives and variants", () => {
  const { container } = render(
    <AlertDialog open>
      <AlertDialogTrigger>Delete</AlertDialogTrigger>
      <AlertDialogPortal>
        <div data-testid="alert-dialog-portal-child" />
      </AlertDialogPortal>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <span data-testid="alert-dialog-media-icon" />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete save</AlertDialogTitle>
          <AlertDialogDescription>
            Permanently remove this save.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive">
            Delete forever
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>,
  );

  expect(
    container.querySelector('[data-slot="alert-dialog-trigger"]'),
  ).toHaveTextContent("Delete");
  expect(screen.getByTestId("alert-dialog-portal-child")).toBeInTheDocument();
  expect(
    document.body.querySelector('[data-slot="alert-dialog-content"]'),
  ).toHaveAttribute("data-size", "sm");
  expect(
    screen
      .getByTestId("alert-dialog-media-icon")
      .closest('[data-slot="alert-dialog-media"]'),
  ).not.toBeNull();
  expect(screen.getByText("Delete save")).toHaveAttribute(
    "data-slot",
    "alert-dialog-title",
  );
  expect(screen.getByText("Permanently remove this save.")).toHaveAttribute(
    "data-slot",
    "alert-dialog-description",
  );
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute(
    "data-slot",
    "alert-dialog-cancel",
  );
  expect(
    screen.getByRole("button", { name: "Delete forever" }),
  ).toHaveAttribute("data-slot", "alert-dialog-action");
  expect(
    screen.getByRole("button", { name: "Delete forever" }),
  ).toHaveAttribute("data-variant", "destructive");
});

test("renders default content, overlay, and button variants", () => {
  render(
    <AlertDialog open>
      <AlertDialogTrigger>Open</AlertDialogTrigger>
      <AlertDialogOverlay className="custom-overlay" />
      <AlertDialogContent>
        <AlertDialogHeader className="custom-header">
          <AlertDialogTitle>Heads up</AlertDialogTitle>
          <AlertDialogDescription>
            Default dialog content.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="custom-footer">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>,
  );

  expect(
    document.body.querySelector('[data-slot="alert-dialog-overlay"]'),
  ).toHaveClass("custom-overlay");
  expect(
    document.body.querySelector('[data-slot="alert-dialog-content"]'),
  ).toHaveAttribute("data-size", "default");
  expect(screen.getByText("Heads up")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute(
    "data-variant",
    "outline",
  );
  expect(screen.getByRole("button", { name: "Confirm" })).toHaveAttribute(
    "data-variant",
    "default",
  );
});
