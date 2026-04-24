import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { getSlot } from "~/lib/get-slot";

test("renders dialog content and close controls", () => {
  render(
    <Dialog open>
      <DialogTrigger>Open</DialogTrigger>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <DialogClose>Dismiss</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>,
  );

  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(getSlot("dialog-title")).toHaveTextContent("Title");
  expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(2);
});

test("renders dialog content without generated close buttons", () => {
  render(
    <Dialog open>
      <DialogContent showCloseButton={false}>
        <DialogTitle>No close</DialogTitle>
        <DialogFooter>Footer only</DialogFooter>
      </DialogContent>
    </Dialog>,
  );

  expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  expect(getSlot("dialog-footer")).toHaveTextContent("Footer only");
});

test("renders dialog content default close button", () => {
  render(
    <Dialog open>
      <DialogContent>
        <DialogTitle>Default close</DialogTitle>
      </DialogContent>
    </Dialog>,
  );

  expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
});
