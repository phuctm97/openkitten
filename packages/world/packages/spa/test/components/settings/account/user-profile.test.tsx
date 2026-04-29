import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  defaultSession,
  mockReactPacer,
  mockSonner,
  setupSettingsMocks,
} from "~/test/components/settings/mock-better-auth-ui-settings";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockChangeAvatar() {
  vi.doMock("~/components/settings/account/change-avatar", () => ({
    ChangeAvatar: () => <div data-testid="change-avatar" />,
  }));
}

test("submits a new name and username and toasts on success", async () => {
  const sonner = mockSonner();
  mockReactPacer();
  const mocks = setupSettingsMocks({
    auth: {
      username: {
        displayUsername: false,
        enabled: true,
        isUsernameAvailable: true,
        maxUsernameLength: 20,
        minUsernameLength: 3,
      },
    },
  });
  mockChangeAvatar();
  const { UserProfile } = await import(
    "~/components/settings/account/user-profile"
  );

  render(<UserProfile className="profile" />);

  const usernameInput = screen.getByLabelText("Username");
  fireEvent.change(usernameInput, { target: { value: "newkitten" } });

  const nameInput = screen.getByLabelText("Name");
  fireEvent.change(nameInput, { target: { value: "New Kitten" } });
  fireEvent.submit(screen.getByRole("button", { name: "Save changes" }));

  expect(mocks.updateUser).toHaveBeenCalledWith({
    name: "New Kitten",
    username: "newkitten",
  });

  mocks.captured.updateUserAvatar?.onSuccess?.();
  expect(sonner.toastSuccess).toHaveBeenCalledWith("Profile updated");
});

test("includes displayUsername when configured", async () => {
  mockSonner();
  mockReactPacer();
  const mocks = setupSettingsMocks({
    auth: {
      username: {
        displayUsername: true,
        enabled: true,
        isUsernameAvailable: false,
        maxUsernameLength: 20,
        minUsernameLength: 3,
      },
    },
  });
  mockChangeAvatar();
  const { UserProfile } = await import(
    "~/components/settings/account/user-profile"
  );

  render(<UserProfile />);

  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "DisplayKitten" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Save changes" }));

  expect(mocks.updateUser).toHaveBeenCalledWith({
    name: "Open Kitten",
    username: "DisplayKitten",
    displayUsername: "DisplayKitten",
  });
});

test("submits without username block when username feature is disabled", async () => {
  mockSonner();
  mockReactPacer();
  const mocks = setupSettingsMocks({
    auth: {
      username: {
        displayUsername: false,
        enabled: false,
        isUsernameAvailable: false,
        maxUsernameLength: 20,
        minUsernameLength: 3,
      },
    },
  });
  mockChangeAvatar();
  const { UserProfile } = await import(
    "~/components/settings/account/user-profile"
  );

  render(<UserProfile />);

  expect(screen.queryByLabelText("Username")).toBeNull();

  fireEvent.submit(screen.getByRole("button", { name: "Save changes" }));

  expect(mocks.updateUser).toHaveBeenCalledWith({
    name: "Open Kitten",
  });
});

test("triggers username availability check via debouncer and resets on idle", async () => {
  mockSonner();
  const pacer = mockReactPacer();
  const mocks = setupSettingsMocks({
    auth: {
      username: {
        displayUsername: false,
        enabled: true,
        isUsernameAvailable: true,
        maxUsernameLength: 20,
        minUsernameLength: 3,
      },
    },
  });
  mockChangeAvatar();
  const { UserProfile } = await import(
    "~/components/settings/account/user-profile"
  );

  render(<UserProfile />);

  const usernameInput = screen.getByLabelText("Username");
  fireEvent.change(usernameInput, { target: { value: "candidate" } });

  expect(pacer.maybeExecute).toHaveBeenCalledWith("candidate");
  expect(mocks.isUsernameAvailable).toHaveBeenCalledWith({
    username: "candidate",
  });

  fireEvent.change(usernameInput, { target: { value: "  " } });
  expect(mocks.resetUsername).toHaveBeenCalled();
});

test("resets the availability check when the value matches the current username", async () => {
  mockSonner();
  mockReactPacer();
  const mocks = setupSettingsMocks({
    auth: {
      username: {
        displayUsername: false,
        enabled: true,
        isUsernameAvailable: true,
        maxUsernameLength: 20,
        minUsernameLength: 3,
      },
    },
    session: {
      session: { ...defaultSession.session, id: "s", token: "t", userId: "u" },
      user: {
        ...defaultSession.user,
        displayUsername: null,
        email: "k@kitten.dev",
        emailVerified: true,
        id: "u",
        image: null,
        name: "Kitten",
        username: "current",
      },
    },
  });
  mockChangeAvatar();
  const { UserProfile } = await import(
    "~/components/settings/account/user-profile"
  );

  render(<UserProfile />);

  const usernameInput = screen.getByLabelText("Username");
  fireEvent.change(usernameInput, { target: { value: "newvalue" } });
  expect(mocks.isUsernameAvailable).toHaveBeenCalledWith({
    username: "newvalue",
  });

  mocks.isUsernameAvailable.mockClear();
  mocks.resetUsername.mockClear();

  fireEvent.change(usernameInput, { target: { value: "current" } });

  expect(mocks.resetUsername).toHaveBeenCalled();
  expect(mocks.isUsernameAvailable).not.toHaveBeenCalled();
});

test("renders the available indicator when the username is available", async () => {
  mockSonner();
  mockReactPacer();
  setupSettingsMocks({
    auth: {
      username: {
        displayUsername: false,
        enabled: true,
        isUsernameAvailable: true,
        maxUsernameLength: 20,
        minUsernameLength: 3,
      },
    },
    username: { data: { available: true } },
  });
  mockChangeAvatar();
  const { UserProfile } = await import(
    "~/components/settings/account/user-profile"
  );

  const { container } = render(<UserProfile />);

  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "candidate" },
  });

  expect(container.querySelector(".text-foreground")).not.toBeNull();
});

test("renders the unavailable indicator and error message when username is taken", async () => {
  mockSonner();
  mockReactPacer();
  setupSettingsMocks({
    auth: {
      username: {
        displayUsername: false,
        enabled: true,
        isUsernameAvailable: true,
        maxUsernameLength: 20,
        minUsernameLength: 3,
      },
    },
    username: { data: { available: false } },
  });
  mockChangeAvatar();
  const { UserProfile } = await import(
    "~/components/settings/account/user-profile"
  );

  render(<UserProfile />);

  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "taken" },
  });

  expect(screen.getByText("Username is already taken")).toBeInTheDocument();
});

test("renders the spinner state when checking and prefers nested error message", async () => {
  mockSonner();
  mockReactPacer();
  setupSettingsMocks({
    auth: {
      username: {
        displayUsername: false,
        enabled: true,
        isUsernameAvailable: true,
        maxUsernameLength: 20,
        minUsernameLength: 3,
      },
    },
    username: {},
  });
  mockChangeAvatar();
  const { UserProfile } = await import(
    "~/components/settings/account/user-profile"
  );

  render(<UserProfile />);

  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "candidate" },
  });

  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});

test("renders the error icon when usernameError is set", async () => {
  mockSonner();
  mockReactPacer();
  setupSettingsMocks({
    auth: {
      username: {
        displayUsername: false,
        enabled: true,
        isUsernameAvailable: true,
        maxUsernameLength: 20,
        minUsernameLength: 3,
      },
    },
    username: { error: { error: { message: "API said no" } } },
  });
  mockChangeAvatar();
  const { UserProfile } = await import(
    "~/components/settings/account/user-profile"
  );

  render(<UserProfile />);

  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "candidate" },
  });

  expect(screen.getByText("API said no")).toBeInTheDocument();
});

test("falls back to the top-level error message when nested error is missing", async () => {
  mockSonner();
  mockReactPacer();
  setupSettingsMocks({
    auth: {
      username: {
        displayUsername: false,
        enabled: true,
        isUsernameAvailable: true,
        maxUsernameLength: 20,
        minUsernameLength: 3,
      },
    },
    username: { error: { message: "Top-level error" } },
  });
  mockChangeAvatar();
  const { UserProfile } = await import(
    "~/components/settings/account/user-profile"
  );

  render(<UserProfile />);

  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "candidate" },
  });

  expect(screen.getByText("Top-level error")).toBeInTheDocument();
});

test("renders skeletons when the session is loading", async () => {
  mockSonner();
  mockReactPacer();
  setupSettingsMocks({
    auth: {
      username: {
        displayUsername: false,
        enabled: true,
        isUsernameAvailable: true,
        maxUsernameLength: 20,
        minUsernameLength: 3,
      },
    },
    session: null,
  });
  mockChangeAvatar();
  const { UserProfile } = await import(
    "~/components/settings/account/user-profile"
  );

  const { container } = render(<UserProfile />);

  expect(
    container.querySelectorAll("[data-slot='skeleton']").length,
  ).toBeGreaterThan(0);
});

test("captures invalid name validation message", async () => {
  mockSonner();
  mockReactPacer();
  setupSettingsMocks();
  mockChangeAvatar();
  const { UserProfile } = await import(
    "~/components/settings/account/user-profile"
  );

  render(<UserProfile />);

  const nameInput = screen.getByLabelText("Name");
  Object.defineProperty(nameInput, "validationMessage", {
    configurable: true,
    value: "Name is required",
  });

  fireEvent.invalid(nameInput);
  expect(screen.getByText("Name is required")).toBeInTheDocument();

  fireEvent.change(nameInput, { target: { value: "Kitten" } });
  expect(nameInput).toHaveAttribute("aria-invalid", "false");
});

test("does not run availability checks when isUsernameAvailable is disabled", async () => {
  mockSonner();
  const pacer = mockReactPacer();
  setupSettingsMocks({
    auth: {
      username: {
        displayUsername: false,
        enabled: true,
        isUsernameAvailable: false,
        maxUsernameLength: 20,
        minUsernameLength: 3,
      },
    },
  });
  mockChangeAvatar();
  const { UserProfile } = await import(
    "~/components/settings/account/user-profile"
  );

  render(<UserProfile />);

  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "candidate" },
  });

  expect(pacer.maybeExecute).not.toHaveBeenCalled();
});

test("uses displayUsername as initial value when configured", async () => {
  mockSonner();
  mockReactPacer();
  setupSettingsMocks({
    auth: {
      username: {
        displayUsername: true,
        enabled: true,
        isUsernameAvailable: false,
        maxUsernameLength: 20,
        minUsernameLength: 3,
      },
    },
    session: {
      session: { ...defaultSession.session, id: "s", token: "t", userId: "u" },
      user: {
        ...defaultSession.user,
        displayUsername: "Display",
        email: "d@kitten.dev",
        emailVerified: true,
        id: "u",
        image: null,
        name: "Kitten",
        username: "lower",
      },
    },
  });
  mockChangeAvatar();
  const { UserProfile } = await import(
    "~/components/settings/account/user-profile"
  );

  render(<UserProfile />);

  expect(screen.getByLabelText("Username")).toHaveValue("Display");
});

test("renders a spinner inside the save button while updateUser is pending", async () => {
  mockSonner();
  mockReactPacer();
  setupSettingsMocks({
    pending: { updateUser: true },
    auth: {
      username: {
        displayUsername: false,
        enabled: false,
        isUsernameAvailable: true,
        maxUsernameLength: 20,
        minUsernameLength: 3,
      },
    },
  });
  mockChangeAvatar();
  const { UserProfile } = await import(
    "~/components/settings/account/user-profile"
  );

  render(<UserProfile />);

  const saveButton = screen.getByRole("button", { name: /save changes/i });
  expect(saveButton.querySelector('[role="status"]')).toBeInTheDocument();
});
