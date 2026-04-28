import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "~/components/ui/pagination";
import { getSlot } from "~/lib/get-slot";

test("renders pagination slots", () => {
  render(
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="/page/1" text="Back" />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="/page/2" isActive>
            2
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="/page/3" text="Forward" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>,
  );

  expect(
    screen.getByRole("navigation", { name: "pagination" }),
  ).toHaveAttribute("data-slot", "pagination");
  expect(screen.getByRole("link", { name: "2" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(getSlot("pagination-ellipsis")).toBeInTheDocument();
});

test("renders default pagination link states and labels", () => {
  render(
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="/previous" />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="/page">Page</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="/next" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>,
  );

  expect(screen.getByRole("link", { name: "Page" })).not.toHaveAttribute(
    "aria-current",
  );
  expect(
    screen.getByRole("link", { name: "Go to previous page" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Go to next page" }),
  ).toBeInTheDocument();
});
