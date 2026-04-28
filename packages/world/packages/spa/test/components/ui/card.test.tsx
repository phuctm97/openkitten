import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

test("renders every card slot", () => {
  render(
    <Card size="sm">
      <CardHeader>
        <CardTitle>Sun Room</CardTitle>
        <CardDescription>Warm and bright.</CardDescription>
        <CardAction>
          <button type="button">Edit</button>
        </CardAction>
      </CardHeader>
      <CardContent>Open windows.</CardContent>
      <CardFooter>Footer actions</CardFooter>
    </Card>,
  );

  expect(
    screen.getByText("Sun Room").closest('[data-slot="card"]'),
  ).toHaveAttribute("data-size", "sm");
  expect(
    screen
      .getByText("Warm and bright.")
      .closest('[data-slot="card-description"]'),
  ).not.toBeNull();
  expect(
    screen
      .getByRole("button", { name: "Edit" })
      .closest('[data-slot="card-action"]'),
  ).not.toBeNull();
  expect(
    screen.getByText("Open windows.").closest('[data-slot="card-content"]'),
  ).not.toBeNull();
  expect(
    screen.getByText("Footer actions").closest('[data-slot="card-footer"]'),
  ).not.toBeNull();
});

test("defaults to the standard card size", () => {
  render(<Card>Quiet corner</Card>);

  expect(screen.getByText("Quiet corner")).toHaveAttribute(
    "data-size",
    "default",
  );
});
