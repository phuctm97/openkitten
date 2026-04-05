import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import Component from "~/app/routes/index";

test("renders the house placeholder and both font previews", () => {
  render(<Component />);
  const monoCard = screen.getByText("Mono").closest("article");

  expect(screen.getByText("House Route Placeholder")).toBeInTheDocument();
  expect(
    screen.getByText(
      "Oxanium gives OpenKitten World its playful, futuristic house voice.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByText("Sans")).toBeInTheDocument();
  expect(screen.getByText("Mono")).toBeInTheDocument();
  expect(monoCard).toHaveTextContent(
    'session.claimedThreads[0] = "pricing-review"',
  );
  expect(monoCard).toHaveTextContent(
    'cat.memory.append("Keep pricing practical and human-readable.")',
  );
});
