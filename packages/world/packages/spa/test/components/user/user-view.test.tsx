import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { setupUserMocks } from "~/test/components/user/mock-user-better-auth";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("renders skeleton placeholders when the session is pending and no user prop is supplied", async () => {
  setupUserMocks({ pending: { session: true }, session: null });
  const { UserView } = await import("~/components/user/user-view");

  const { container } = render(<UserView className="custom" />);
  const skeletons = container.querySelectorAll("[data-slot='skeleton']");
  expect(skeletons.length).toBeGreaterThanOrEqual(2);
  expect(container.firstChild).toHaveClass("custom");
});

test("renders skeleton placeholders when isPending prop is true and no user prop is supplied", async () => {
  setupUserMocks({ session: null });
  const { UserView } = await import("~/components/user/user-view");

  const { container } = render(<UserView isPending />);
  expect(
    container.querySelectorAll("[data-slot='skeleton']").length,
  ).toBeGreaterThanOrEqual(2);
});

test("uses the user prop displayUsername as the primary line and email as secondary", async () => {
  setupUserMocks({ session: null });
  const { UserView } = await import("~/components/user/user-view");

  render(
    <UserView
      user={{
        displayUsername: "Display Kitten",
        email: "kitten@kitten.dev",
        emailVerified: true,
        id: "u",
        image: null,
        name: "Kitten Name",
        createdAt: new Date(),
        updatedAt: new Date(),
      }}
    />,
  );

  expect(screen.getByText("Display Kitten")).toBeInTheDocument();
  expect(screen.getByText("kitten@kitten.dev")).toBeInTheDocument();
});

test("falls back to user.name as the primary line when displayUsername is missing", async () => {
  setupUserMocks({ session: null });
  const { UserView } = await import("~/components/user/user-view");

  render(
    <UserView
      user={{
        email: "name@kitten.dev",
        emailVerified: true,
        id: "u",
        image: null,
        name: "Just Name",
        createdAt: new Date(),
        updatedAt: new Date(),
      }}
    />,
  );

  expect(screen.getByText("Just Name")).toBeInTheDocument();
  expect(screen.getByText("name@kitten.dev")).toBeInTheDocument();
});

test("renders only the email as the primary line when displayUsername and name are absent", async () => {
  setupUserMocks({ session: null });
  const { UserView } = await import("~/components/user/user-view");

  render(
    <UserView
      user={{
        email: "only@kitten.dev",
        emailVerified: true,
        id: "u",
        image: null,
        name: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      }}
    />,
  );

  expect(screen.getAllByText("only@kitten.dev")).toHaveLength(1);
});

test("shows displayUsername as primary and email as secondary when both are present", async () => {
  setupUserMocks({ session: null });
  const { UserView } = await import("~/components/user/user-view");

  render(
    <UserView
      user={{
        displayUsername: "Display Only",
        email: "display@kitten.dev",
        emailVerified: true,
        id: "u",
        image: null,
        name: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      }}
    />,
  );

  expect(screen.getByText("Display Only")).toBeInTheDocument();
  expect(screen.getByText("display@kitten.dev")).toBeInTheDocument();
});

test("shows name as primary and email as secondary when only name is present", async () => {
  setupUserMocks({ session: null });
  const { UserView } = await import("~/components/user/user-view");

  render(
    <UserView
      user={{
        email: "named@kitten.dev",
        emailVerified: true,
        id: "u",
        image: null,
        name: "Named Kitten",
        createdAt: new Date(),
        updatedAt: new Date(),
      }}
    />,
  );

  expect(screen.getByText("Named Kitten")).toBeInTheDocument();
  expect(screen.getByText("named@kitten.dev")).toBeInTheDocument();
});

test("renders gracefully when no user prop, no session, and not pending", async () => {
  setupUserMocks({ session: null });
  const { UserView } = await import("~/components/user/user-view");

  const { container } = render(<UserView />);
  expect(container.querySelector("[data-slot='avatar']")).not.toBeNull();
});

test("falls back to the session user when no user prop is provided", async () => {
  setupUserMocks({
    session: {
      session: { id: "s", token: "t", userId: "u" },
      user: {
        displayUsername: "Session Display",
        email: "session@kitten.dev",
        id: "u",
        image: null,
        name: "Session Name",
      },
    },
  });
  const { UserView } = await import("~/components/user/user-view");

  render(<UserView />);

  expect(screen.getByText("Session Display")).toBeInTheDocument();
  expect(screen.getByText("session@kitten.dev")).toBeInTheDocument();
});
