import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Spinner } from "~/components/ui/spinner";

test("renders a loading spinner", () => {
  render(<Spinner className="size-6" />);

  const spinner = screen.getByRole("status", { name: "Loading" });

  expect(spinner).toHaveClass("animate-spin");
  expect(spinner).toHaveClass("size-6");
});
