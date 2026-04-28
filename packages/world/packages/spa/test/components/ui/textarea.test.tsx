import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Textarea } from "~/components/ui/textarea";

test("renders a textarea element", () => {
  render(<Textarea placeholder="House notes" />);

  const textarea = screen.getByPlaceholderText("House notes");

  expect(textarea).toHaveAttribute("data-slot", "textarea");
});
