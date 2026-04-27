import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, test } from "vitest";

import { TooltipProvider } from "~/components/ui/tooltip";

test("renders the app route as the sidebar dashboard", async () => {
  const { default: Component } = await import("~/app/routes/app");

  render(
    <MemoryRouter>
      <TooltipProvider>
        <Component />
      </TooltipProvider>
    </MemoryRouter>,
  );

  expect(screen.getByRole("banner")).toHaveClass("h-16");
  expect(screen.getByRole("link", { name: /acme inc/i })).toHaveAttribute(
    "href",
    "/app",
  );
  expect(screen.getByText("Data Fetching")).toBeInTheDocument();
  expect(screen.getAllByText("Build Your Application")[0]).toBeInTheDocument();
  expect(screen.queryByText("Hello, world!")).not.toBeInTheDocument();
});
