import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  createMockSession,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

test("renders loading placeholders while the session is pending", async () => {
  setupBetterAuthUiMocks({
    pending: {
      session: true,
    },
    session: null,
  });
  const { UserView } = await import("~/components/user/user-view");

  const { container } = render(<UserView className="user-view" />);

  expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(3);
});

test("prefers displayUsername and shows the email as a secondary line", async () => {
  setupBetterAuthUiMocks();
  const { UserView } = await import("~/components/user/user-view");

  render(
    <UserView
      user={
        createMockSession({
          user: {
            displayUsername: "pixelcat",
            email: "pixel@openkitten.dev",
            name: "Pixel Cat",
          },
        }).user
      }
    />,
  );

  expect(screen.getByText("pixelcat")).toBeInTheDocument();
  expect(screen.getByText("pixel@openkitten.dev")).toBeInTheDocument();
});

test("uses the session user when no explicit user is provided", async () => {
  setupBetterAuthUiMocks();
  const { UserView } = await import("~/components/user/user-view");

  render(<UserView />);

  expect(screen.getByText("openkitten")).toBeInTheDocument();
  expect(screen.getByText("kitten@openkitten.dev")).toBeInTheDocument();
});

test("uses the email as the primary label when there is no display name", async () => {
  setupBetterAuthUiMocks();
  const { UserView } = await import("~/components/user/user-view");

  render(
    <UserView
      user={
        createMockSession({
          user: {
            displayUsername: null,
            email: "solo@openkitten.dev",
            name: "",
            username: null,
          },
        }).user
      }
    />,
  );

  expect(screen.getAllByText("solo@openkitten.dev")).toHaveLength(1);
});

test("uses the name as the primary label and keeps the email as a secondary line", async () => {
  setupBetterAuthUiMocks();
  const { UserView } = await import("~/components/user/user-view");

  render(
    <UserView
      user={
        createMockSession({
          user: {
            displayUsername: "",
            email: "pixel@openkitten.dev",
            name: "Pixel Cat",
            username: "",
          },
        }).user
      }
    />,
  );

  expect(screen.getByText("Pixel Cat")).toBeInTheDocument();
  expect(screen.getByText("pixel@openkitten.dev")).toBeInTheDocument();
});

test("falls back to the session email when no other label is available", async () => {
  setupBetterAuthUiMocks({
    session: createMockSession({
      user: {
        displayUsername: "",
        email: "email-only@openkitten.dev",
        name: "",
        username: "",
      },
    }),
  });
  const { UserView } = await import("~/components/user/user-view");

  render(<UserView />);

  expect(screen.getByText("email-only@openkitten.dev")).toBeInTheDocument();
});
