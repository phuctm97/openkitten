import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";

test("renders breadcrumb primitives", () => {
  const { container } = render(
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/houses">Houses</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Kitchen</BreadcrumbPage>
        </BreadcrumbItem>
        <BreadcrumbItem>
          <BreadcrumbEllipsis />
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>,
  );

  expect(screen.getByLabelText("breadcrumb")).toHaveAttribute(
    "data-slot",
    "breadcrumb",
  );
  expect(
    container.querySelector('[data-slot="breadcrumb-list"]'),
  ).not.toBeNull();
  expect(
    container.querySelector('[data-slot="breadcrumb-item"]'),
  ).not.toBeNull();
  expect(screen.getByRole("link", { name: "Houses" })).toHaveAttribute(
    "data-slot",
    "breadcrumb-link",
  );
  expect(screen.getByText("Kitchen")).toHaveAttribute(
    "data-slot",
    "breadcrumb-page",
  );
  expect(screen.getByText("Kitchen")).toHaveAttribute("aria-current", "page");
  expect(
    container.querySelector('[data-slot="breadcrumb-separator"] svg'),
  ).not.toBeNull();
  expect(screen.getByText("More")).toHaveClass("sr-only");
});

test("renders breadcrumb link as a child slot and custom separator content", () => {
  render(
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <button type="button">Open</button>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>/</BreadcrumbSeparator>
      </BreadcrumbList>
    </Breadcrumb>,
  );

  expect(screen.getByRole("button", { name: "Open" })).toHaveAttribute(
    "data-slot",
    "breadcrumb-link",
  );
  expect(screen.getByText("/")).toHaveAttribute(
    "data-slot",
    "breadcrumb-separator",
  );
});
