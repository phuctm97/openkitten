import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Badge } from "~/components/ui/badge";

test("renders a default badge", () => {
  render(<Badge>Theme</Badge>);

  const badge = screen.getByText("Theme");

  expect(badge).toHaveAttribute("data-slot", "badge");
  expect(badge).toHaveAttribute("data-variant", "default");
});

test("renders as a child element when requested", () => {
  render(
    <Badge asChild variant="outline">
      <a href="/palette">Palette</a>
    </Badge>,
  );

  const link = screen.getByRole("link", { name: "Palette" });

  expect(link).toHaveAttribute("href", "/palette");
  expect(link).toHaveAttribute("data-slot", "badge");
  expect(link).toHaveAttribute("data-variant", "outline");
});
