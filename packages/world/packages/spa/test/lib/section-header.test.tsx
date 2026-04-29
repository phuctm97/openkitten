import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { SectionHeader } from "~/lib/section-header";

test("renders the title", () => {
  render(<SectionHeader title="Cats" />);
  expect(screen.getByRole("heading", { name: "Cats" })).toBeInTheDocument();
});

test("renders the optional description and action when provided", () => {
  render(
    <SectionHeader
      title="Cats"
      description="Workers in this house"
      action={<button type="button">Add</button>}
    />,
  );
  expect(screen.getByText("Workers in this house")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
});
