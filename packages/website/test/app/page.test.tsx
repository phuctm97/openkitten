import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import Page from "~/app/page";

test("renders the hello world heading", () => {
  render(<Page />);

  expect(
    screen.getByRole("heading", { name: "Hello, world!" }),
  ).toBeInTheDocument();
});
