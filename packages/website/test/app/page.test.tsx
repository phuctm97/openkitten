import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";

const { baseLayoutPropsMock, homeLayoutSpy } = vi.hoisted(() => ({
  baseLayoutPropsMock: {
    nav: { title: "OpenKitten" },
  },
  homeLayoutSpy: vi.fn(),
}));

vi.mock("~/lib/base-layout-props", () => ({
  baseLayoutProps: baseLayoutPropsMock,
}));

vi.mock("fumadocs-ui/layouts/home", () => ({
  HomeLayout: ({
    children,
    ...props
  }: {
    children: ReactNode;
    nav?: { title?: string };
  }) => {
    homeLayoutSpy(props);
    return <div data-testid="home-layout">{children}</div>;
  },
}));

import Page from "~/app/page";

test("renders the placeholder landing page inside the shared home layout", () => {
  render(<Page />);

  expect(screen.getByTestId("home-layout")).toBeInTheDocument();
  expect(homeLayoutSpy).toHaveBeenCalledWith({
    links: [
      {
        text: "Docs",
        url: "/docs",
      },
    ],
    nav: { title: "OpenKitten" },
  });
  expect(
    screen.getByRole("heading", {
      name: "OpenKitten",
    }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "docs" })).toHaveAttribute(
    "href",
    "/docs",
  );
  expect(
    screen.getByText(/the landing page is coming soon/i),
  ).toBeInTheDocument();
});
