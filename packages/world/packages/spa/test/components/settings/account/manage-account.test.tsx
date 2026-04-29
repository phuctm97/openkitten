import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  defaultSession,
  mockSonner,
  setupSettingsMocks,
} from "~/test/components/settings/mock-better-auth-ui-settings";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockUserView() {
  vi.doMock("~/components/user/user-view", () => ({
    UserView: ({
      user,
      isPending,
    }: {
      user?: { id?: string };
      isPending?: boolean;
    }) => (
      <div
        data-testid="user-view"
        data-user-id={user?.id ?? ""}
        data-pending={String(Boolean(isPending))}
      />
    ),
  }));
}

const sameSession = {
  session: { ...defaultSession.session, id: "s-1", token: "t-1" },
  user: defaultSession.user,
};
const otherSession = {
  session: {
    ...defaultSession.session,
    id: "s-2",
    token: "t-2",
    userId: "user-2",
  },
  user: { ...defaultSession.user, id: "user-2", email: "two@kitten.dev" },
};

test("renders sign-out button for the active session and revokes via mutation", async () => {
  const sonner = mockSonner();
  const mocks = setupSettingsMocks();
  mockUserView();
  const { ManageAccount } = await import(
    "~/components/settings/account/manage-account"
  );

  render(<ManageAccount deviceSession={sameSession} />);

  fireEvent.click(screen.getByRole("button", { name: /Sign out/u }));
  expect(mocks.revokeMultiSession).toHaveBeenCalledWith({
    sessionToken: "t-1",
  });

  mocks.captured.revokeMultiSession?.onSuccess?.();
  expect(sonner.toastSuccess).toHaveBeenCalledWith("Session revoked");
});

test("shows a spinner on the sign-out button while revoking is pending", async () => {
  mockSonner();
  setupSettingsMocks({ pending: { revokeMultiSession: true } });
  mockUserView();
  const { ManageAccount } = await import(
    "~/components/settings/account/manage-account"
  );

  render(<ManageAccount deviceSession={sameSession} />);

  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});

test("non-active session opens dropdown and switches via setActiveSession", async () => {
  mockSonner();
  const mocks = setupSettingsMocks();
  mockUserView();
  const { ManageAccount } = await import(
    "~/components/settings/account/manage-account"
  );

  render(<ManageAccount deviceSession={otherSession} />);

  const user = userEvent.setup();
  await user.click(screen.getByRole("button"));

  await user.click(
    await screen.findByRole("menuitem", { name: /Switch account/u }),
  );

  expect(mocks.setActiveSession).toHaveBeenCalledWith({
    sessionToken: "t-2",
  });
});

test("non-active session can sign out via dropdown menu", async () => {
  mockSonner();
  const mocks = setupSettingsMocks();
  mockUserView();
  const { ManageAccount } = await import(
    "~/components/settings/account/manage-account"
  );

  render(<ManageAccount deviceSession={otherSession} />);

  const user = userEvent.setup();
  await user.click(screen.getByRole("button"));
  await user.click(await screen.findByRole("menuitem", { name: /Sign out/u }));

  expect(mocks.revokeMultiSession).toHaveBeenCalledWith({
    sessionToken: "t-2",
  });
});

test("renders only the user view in pending placeholder mode", async () => {
  mockSonner();
  setupSettingsMocks();
  mockUserView();
  const { ManageAccount } = await import(
    "~/components/settings/account/manage-account"
  );

  render(<ManageAccount deviceSession={null} isPending />);

  expect(screen.getByTestId("user-view")).toHaveAttribute(
    "data-pending",
    "true",
  );
  expect(screen.queryByRole("button")).toBeNull();
});

test("disables actions while switching is pending for active session", async () => {
  mockSonner();
  setupSettingsMocks({ pending: { setActiveSession: true } });
  mockUserView();
  const { ManageAccount } = await import(
    "~/components/settings/account/manage-account"
  );

  render(<ManageAccount deviceSession={sameSession} />);

  expect(screen.getByRole("button", { name: /Sign out/u })).toBeDisabled();
});
