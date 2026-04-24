import { render, screen } from "@testing-library/react";
import { InboxIcon } from "lucide-react";
import { expect, test } from "vitest";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { getSlot } from "~/lib/get-slot";

test("renders empty state slots", () => {
  render(
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon />
        </EmptyMedia>
        <EmptyTitle>No messages</EmptyTitle>
        <EmptyDescription>There is nothing here.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>Try again later.</EmptyContent>
    </Empty>,
  );

  expect(getSlot("empty")).toBeInTheDocument();
  expect(getSlot("empty-icon")).toHaveAttribute("data-variant", "icon");
  expect(screen.getByText("No messages")).toHaveAttribute(
    "data-slot",
    "empty-title",
  );
});

test("renders default empty media", () => {
  render(<EmptyMedia>Media</EmptyMedia>);

  expect(getSlot("empty-icon")).toHaveAttribute("data-variant", "default");
});
