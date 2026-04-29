import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { LoadingState } from "~/lib/loading-state";

test("renders the shared loading state", () => {
  const { container } = render(<LoadingState />);

  const status = screen.getByRole("status");

  expect(status).toHaveAttribute("aria-live", "polite");
  expect(screen.getByText("Loading OpenKitten")).toBeInTheDocument();
  expect(container.firstChild).toHaveClass("grid", "min-h-screen");
  expect(status.firstChild).toHaveClass("size-14");
});
