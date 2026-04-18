import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  createMockSession,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

function mockDropdownMenuItem() {
  vi.doMock("~/components/ui/dropdown-menu", () => ({
    DropdownMenuItem: ({
      children,
      onSelect,
    }: {
      children: ReactNode;
      onSelect?: () => void;
    }) => (
      <button onClick={onSelect} type="button">
        {children}
      </button>
    ),
  }));
}

test("switches to the selected device session and shows pending state", async () => {
  const mocks = setupBetterAuthUiMocks({
    pending: {
      setActiveSession: true,
    },
  });
  mockDropdownMenuItem();
  const { SwitchAccountItem } = await import(
    "~/components/user/switch-account-item"
  );

  render(
    <SwitchAccountItem
      deviceSession={createMockSession({
        session: { id: "session-2", token: "session-token-2" },
        user: {
          email: "other@openkitten.dev",
          name: "Other Kitten",
        },
      })}
    />,
  );

  fireEvent.click(screen.getByRole("button"));

  expect(mocks.setActiveSession).toHaveBeenCalledWith({
    sessionToken: "session-token-2",
  });
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});
