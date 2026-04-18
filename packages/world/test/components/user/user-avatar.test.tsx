import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  createMockSession,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

test("renders a loading skeleton while the session is pending", async () => {
  setupBetterAuthUiMocks({
    pending: {
      session: true,
    },
    session: null,
  });
  const { UserAvatar } = await import("~/components/user/user-avatar");

  const { container } = render(<UserAvatar className="avatar" />);

  expect(container.querySelector('[data-slot="skeleton"]')).toHaveClass(
    "avatar",
  );
});

test("renders initials or a provided fallback for the resolved user", async () => {
  setupBetterAuthUiMocks();
  const { UserAvatar } = await import("~/components/user/user-avatar");

  const customUser = createMockSession({
    user: {
      displayUsername: null,
      email: "zzz@openkitten.dev",
      image: null,
      name: "",
      username: "zztop",
    },
  }).user;

  const { rerender } = render(<UserAvatar user={customUser} />);

  expect(screen.getByText("ZZ")).toBeInTheDocument();

  rerender(<UserAvatar fallback={<span>?</span>} user={customUser} />);

  expect(screen.getByText("?")).toBeInTheDocument();
});

test("uses the session user when no explicit user is provided", async () => {
  setupBetterAuthUiMocks();
  const { UserAvatar } = await import("~/components/user/user-avatar");

  render(<UserAvatar />);

  expect(screen.getByText("OP")).toBeInTheDocument();
});

test("falls back to name or email initials when username is unavailable", async () => {
  setupBetterAuthUiMocks();
  const { UserAvatar } = await import("~/components/user/user-avatar");

  const { rerender } = render(
    <UserAvatar
      user={
        createMockSession({
          user: {
            displayUsername: null,
            email: "name@openkitten.dev",
            image: null,
            name: "Pixel Cat",
            username: "",
          },
        }).user
      }
    />,
  );

  expect(screen.getByText("PI")).toBeInTheDocument();

  rerender(
    <UserAvatar
      user={
        createMockSession({
          user: {
            displayUsername: null,
            email: "solo@openkitten.dev",
            image: null,
            name: "",
            username: "",
          },
        }).user
      }
    />,
  );

  expect(screen.getByText("SO")).toBeInTheDocument();
});

test("prefers display name text for the image alt and falls back to the icon when empty", async () => {
  setupBetterAuthUiMocks();
  const { UserAvatar } = await import("~/components/user/user-avatar");

  const { container, rerender } = render(
    <UserAvatar
      user={
        createMockSession({
          user: {
            displayUsername: "",
            email: "pixel@openkitten.dev",
            image: "https://cdn.openkitten.dev/avatar.webp",
            name: "Pixel Cat",
            username: "",
          },
        }).user
      }
    />,
  );

  expect(container.querySelector('[data-slot="avatar"]')).not.toBeNull();

  rerender(
    <UserAvatar
      user={
        createMockSession({
          user: {
            displayUsername: "",
            email: "",
            image: null,
            name: "",
            username: "",
          },
        }).user
      }
    />,
  );

  expect(container.querySelector('[data-slot="avatar"]')).not.toBeNull();
});
