import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Button } from "~/components/ui/button";

test("renders a default button", () => {
  render(<Button>Open House</Button>);

  const button = screen.getByRole("button", { name: "Open House" });

  expect(button).toHaveAttribute("data-slot", "button");
  expect(button).toHaveAttribute("data-variant", "default");
  expect(button).toHaveAttribute("data-size", "default");
});

test("renders as a child element when requested", () => {
  render(
    <Button asChild variant="outline" size="sm">
      <a href="/house">Visit House</a>
    </Button>,
  );

  const link = screen.getByRole("link", { name: "Visit House" });

  expect(link).toHaveAttribute("href", "/house");
  expect(link).toHaveAttribute("data-slot", "button");
  expect(link).toHaveAttribute("data-variant", "outline");
  expect(link).toHaveAttribute("data-size", "sm");
});
