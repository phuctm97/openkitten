import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";

vi.mock("~/components/ui/avatar", () => ({
  Avatar: ({ children, size }: { children?: ReactNode; size?: string }) => (
    <span data-testid="avatar" data-size={size}>
      {children}
    </span>
  ),
  AvatarImage: ({ src, alt }: { src?: string; alt?: string }) => (
    <img data-testid="avatar-image" src={src} alt={alt} />
  ),
  AvatarFallback: ({ children }: { children?: ReactNode }) => (
    <span data-testid="avatar-fallback">{children}</span>
  ),
}));

const { CatAvatar } = await import("~/lib/cat-avatar");

test("renders an image when avatar URL is provided", () => {
  render(<CatAvatar cat={{ name: "Misty", avatar: "/cat.png" }} />);
  const img = screen.getByTestId("avatar-image");
  expect(img).toHaveAttribute("src", "/cat.png");
  expect(img).toHaveAttribute("alt", "Misty");
});

test("renders initials in fallback for a single name", () => {
  render(<CatAvatar cat={{ name: "Misty", avatar: null }} />);
  expect(screen.getByText("M")).toBeInTheDocument();
});

test("renders first and last initials for a multi-word name", () => {
  render(<CatAvatar cat={{ name: "Sage Kitten", avatar: null }} />);
  expect(screen.getByText("SK")).toBeInTheDocument();
});

test("renders a question mark when name is empty", () => {
  render(<CatAvatar cat={{ name: " ", avatar: null }} />);
  expect(screen.getByText("?")).toBeInTheDocument();
});

test("renders a question mark for a name with only one whitespace", () => {
  render(<CatAvatar cat={{ name: "", avatar: null }} />);
  expect(screen.getByText("?")).toBeInTheDocument();
});

test("accepts custom size prop", () => {
  render(<CatAvatar cat={{ name: "Misty", avatar: null }} size="lg" />);
  expect(screen.getByTestId("avatar")).toHaveAttribute("data-size", "lg");
});

test("does not render an image when avatar is null", () => {
  render(<CatAvatar cat={{ name: "Misty", avatar: null }} />);
  expect(screen.queryByTestId("avatar-image")).toBeNull();
});
