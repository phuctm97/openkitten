import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";

const startAuthSessionSync = vi.hoisted(() => vi.fn());

vi.mock("~/lib/start-auth-session-sync", () => ({ startAuthSessionSync }));

const { AuthSessionConnector } = await import("~/lib/auth-session-connector");

test("starts the auth session sync on mount and renders nothing", () => {
  const { container } = render(<AuthSessionConnector />);
  expect(startAuthSessionSync).toHaveBeenCalledTimes(1);
  expect(container.innerHTML).toBe("");
});
