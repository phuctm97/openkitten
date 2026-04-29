import { render, screen } from "@testing-library/react";
import { CatIcon } from "lucide-react";
import { expect, test } from "vitest";
import { EmptyState } from "~/lib/empty-state";

test("renders the title and icon", () => {
  render(<EmptyState icon={CatIcon} title="No cats yet" />);
  expect(screen.getByText("No cats yet")).toBeInTheDocument();
});

test("renders the optional description and action when provided", () => {
  render(
    <EmptyState
      icon={CatIcon}
      title="No cats yet"
      description="Adopt one to start"
      action={<button type="button">Adopt</button>}
    />,
  );
  expect(screen.getByText("Adopt one to start")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Adopt" })).toBeInTheDocument();
});
