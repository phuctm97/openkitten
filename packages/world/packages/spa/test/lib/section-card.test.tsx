import { render, screen } from "@testing-library/react";
import { CatIcon } from "lucide-react";
import { MemoryRouter } from "react-router";
import { expect, test } from "vitest";
import { SectionCard } from "~/lib/section-card";

test("renders the label, see-all link, and children", () => {
  render(
    <MemoryRouter>
      <SectionCard icon={CatIcon} label="Cats" to="/app/cats">
        <span>Body</span>
      </SectionCard>
    </MemoryRouter>,
  );
  expect(screen.getByText("Cats")).toBeInTheDocument();
  expect(screen.getByText("Body")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /see all/i })).toHaveAttribute(
    "href",
    "/app/cats",
  );
});

test("renders the optional meta dot when provided", () => {
  render(
    <MemoryRouter>
      <SectionCard icon={CatIcon} label="Cats" meta="3 in residence" to="/x">
        <span />
      </SectionCard>
    </MemoryRouter>,
  );
  expect(screen.getByText("· 3 in residence")).toBeInTheDocument();
});

test("merges the optional className prop", () => {
  const { container } = render(
    <MemoryRouter>
      <SectionCard icon={CatIcon} label="Cats" to="/x" className="custom-class">
        <span />
      </SectionCard>
    </MemoryRouter>,
  );
  expect(container.querySelector("article")).toHaveClass("custom-class");
});
