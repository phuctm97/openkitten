import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Input } from "~/components/ui/input";

test("renders an input element", () => {
  render(<Input disabled placeholder="Email" type="email" />);

  const input = screen.getByPlaceholderText("Email");

  expect(input).toHaveAttribute("data-slot", "input");
  expect(input).toHaveAttribute("type", "email");
  expect(input).toBeDisabled();
});
