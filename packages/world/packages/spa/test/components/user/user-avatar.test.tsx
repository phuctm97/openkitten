import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { setupUserMocks } from "~/test/components/user/mock-user-better-auth";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("renders the resolved user's avatar fallback with initials when image is set", async () => {
  setupUserMocks({
    session: {
      session: { id: "s", token: "t", userId: "u" },
      user: {
        displayUsername: "Display Kitten",
        email: "kitten@kitten.dev",
        id: "u",
        image: "https://cdn/kitten.png",
        name: "Kitten",
        username: "openkitten",
      },
    },
  });
  const { UserAvatar } = await import("~/components/user/user-avatar");

  const { container } = render(<UserAvatar className="custom" />);
  expect(container.querySelector("[data-slot='avatar']")).toHaveClass("custom");
});

test("renders initials with the username when no image is available", async () => {
  setupUserMocks({
    session: {
      session: { id: "s", token: "t", userId: "u" },
      user: {
        email: "k@kitten.dev",
        id: "u",
        image: null,
        name: "Kitten",
        username: "kitten-name",
      },
    },
  });
  const { UserAvatar } = await import("~/components/user/user-avatar");

  render(<UserAvatar />);
  await waitFor(() => {
    expect(screen.getByText("KI")).toBeInTheDocument();
  });
});

test("falls back to name initials when no username is present", async () => {
  setupUserMocks({
    session: {
      session: { id: "s", token: "t", userId: "u" },
      user: {
        email: "k@kitten.dev",
        id: "u",
        image: null,
        name: "Kitten",
      },
    },
  });
  const { UserAvatar } = await import("~/components/user/user-avatar");

  render(<UserAvatar />);
  await waitFor(() => {
    expect(screen.getByText("KI")).toBeInTheDocument();
  });
});

test("falls back to email initials when neither username nor name is present", async () => {
  setupUserMocks({
    session: {
      session: { id: "s", token: "t", userId: "u" },
      user: {
        email: "z@kitten.dev",
        id: "u",
      },
    },
  });
  const { UserAvatar } = await import("~/components/user/user-avatar");

  render(<UserAvatar />);
  await waitFor(() => {
    expect(screen.getByText("Z@")).toBeInTheDocument();
  });
});

test("renders the User2 icon when no identifying data is available", async () => {
  setupUserMocks({ session: null });
  const { UserAvatar } = await import("~/components/user/user-avatar");

  const { container } = render(
    <UserAvatar
      user={{
        email: "",
        emailVerified: true,
        id: "u",
        name: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      }}
    />,
  );
  expect(container.querySelector("[data-slot='avatar']")).not.toBeNull();
});

test("renders an explicit fallback node when provided", async () => {
  setupUserMocks();
  const { UserAvatar } = await import("~/components/user/user-avatar");

  render(
    <UserAvatar
      user={{
        email: "",
        emailVerified: true,
        id: "u",
        name: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      }}
      fallback={<span data-testid="fallback">FB</span>}
    />,
  );

  await waitFor(() => {
    expect(screen.getByTestId("fallback")).toBeInTheDocument();
  });
});

test("renders a skeleton when the session is loading", async () => {
  setupUserMocks({ pending: { session: true }, session: null });
  const { UserAvatar } = await import("~/components/user/user-avatar");

  const { container } = render(<UserAvatar />);
  expect(container.querySelector("[data-slot='skeleton']")).not.toBeNull();
});

test("renders a skeleton when explicitly pending and no user is provided", async () => {
  setupUserMocks();
  const { UserAvatar } = await import("~/components/user/user-avatar");

  const { container } = render(<UserAvatar isPending />);
  expect(container.querySelector("[data-slot='skeleton']")).not.toBeNull();
});

test("uses the explicit user prop over the session", async () => {
  setupUserMocks();
  const { UserAvatar } = await import("~/components/user/user-avatar");

  const { container } = render(
    <UserAvatar
      user={{
        displayUsername: "Override",
        email: "o@kitten.dev",
        emailVerified: true,
        id: "o",
        image: "https://cdn/o.png",
        name: "Override",
        createdAt: new Date(),
        updatedAt: new Date(),
      }}
    />,
  );
  expect(container.querySelector("[data-slot='avatar']")).not.toBeNull();
});

test("uses the user.name when displayUsername is missing", async () => {
  setupUserMocks();
  const { UserAvatar } = await import("~/components/user/user-avatar");

  const { container } = render(
    <UserAvatar
      user={{
        email: "n@kitten.dev",
        emailVerified: true,
        id: "n",
        image: "https://cdn/n.png",
        name: "Just Name",
        createdAt: new Date(),
        updatedAt: new Date(),
      }}
    />,
  );
  expect(container.querySelector("[data-slot='avatar']")).not.toBeNull();
});

test("uses the user.email when no name or display name", async () => {
  setupUserMocks();
  const { UserAvatar } = await import("~/components/user/user-avatar");

  const { container } = render(
    <UserAvatar
      user={{
        email: "only-email@kitten.dev",
        emailVerified: true,
        id: "n",
        image: "https://cdn/n.png",
        name: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      }}
    />,
  );
  expect(container.querySelector("[data-slot='avatar']")).not.toBeNull();
});
