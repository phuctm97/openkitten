import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  mockReactPacer,
  mockSonnerToast,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

test("renders loading placeholders when no session is available", async () => {
  setupBetterAuthUiMocks({
    auth: {
      username: {
        enabled: true,
      },
    },
    session: null,
  });
  vi.doMock("~/components/settings/account/change-avatar", () => ({
    ChangeAvatar: () => <div data-testid="change-avatar" />,
  }));
  const { UserProfile } = await import(
    "~/components/settings/account/user-profile"
  );

  render(<UserProfile />);

  expect(screen.getByTestId("change-avatar")).toBeInTheDocument();
  expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBe(2);
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
});

test("checks username availability and submits updated profile data", async () => {
  const toast = mockSonnerToast();
  const pacer = mockReactPacer();
  const mocks = setupBetterAuthUiMocks({
    auth: {
      username: {
        displayUsername: true,
        enabled: true,
        isUsernameAvailable: true,
        maxUsernameLength: 20,
        minUsernameLength: 3,
      },
    },
    username: {
      data: {
        available: true,
      },
    },
  });
  vi.doMock("~/components/settings/account/change-avatar", () => ({
    ChangeAvatar: () => <div data-testid="change-avatar" />,
  }));
  const { UserProfile } = await import(
    "~/components/settings/account/user-profile"
  );

  render(<UserProfile />);

  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "pixelcat" },
  });
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Pixel Cat" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Save changes" }));

  expect(mocks.resetUsernameAvailability).toHaveBeenCalled();
  expect(pacer.maybeExecute).toHaveBeenCalledWith("pixelcat");
  expect(mocks.checkUsernameAvailability).toHaveBeenCalledWith({
    username: "pixelcat",
  });
  expect(mocks.updateUser).toHaveBeenCalledWith({
    displayUsername: "pixelcat",
    name: "Pixel Cat",
    username: "pixelcat",
  });

  mocks.captured.updateUser?.onSuccess?.();
  expect(toast.toastSuccess).toHaveBeenCalledWith("Profile updated");
});

test("resets username availability for blank values and shows the pending indicator", async () => {
  const pacer = mockReactPacer();
  const mocks = setupBetterAuthUiMocks({
    auth: {
      username: {
        enabled: true,
        isUsernameAvailable: true,
        maxUsernameLength: 20,
        minUsernameLength: 3,
      },
    },
  });
  vi.doMock("~/components/settings/account/change-avatar", () => ({
    ChangeAvatar: () => <div data-testid="change-avatar" />,
  }));
  const { UserProfile } = await import(
    "~/components/settings/account/user-profile"
  );

  render(<UserProfile />);

  const usernameInput = screen.getByLabelText("Username");

  fireEvent.change(usernameInput, {
    target: { value: "   " },
  });

  expect(mocks.resetUsernameAvailability).toHaveBeenCalled();
  expect(mocks.checkUsernameAvailability).not.toHaveBeenCalled();

  fireEvent.change(usernameInput, {
    target: { value: "pixelcat" },
  });

  expect(pacer.maybeExecute).toHaveBeenCalledWith("pixelcat");
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});

test("validates the name field and forwards update errors when usernames are disabled", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    auth: {
      username: {
        enabled: false,
      },
    },
  });
  vi.doMock("~/components/settings/account/change-avatar", () => ({
    ChangeAvatar: () => <div data-testid="change-avatar" />,
  }));
  const { UserProfile } = await import(
    "~/components/settings/account/user-profile"
  );

  render(<UserProfile />);

  const nameInput = screen.getByLabelText("Name");

  if (!(nameInput instanceof HTMLInputElement)) {
    throw new Error("Expected a name input");
  }

  nameInput.setCustomValidity("Name is required");
  fireEvent.invalid(nameInput);

  expect(nameInput).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByText("Name is required")).toBeInTheDocument();

  fireEvent.change(nameInput, {
    target: { value: "Pixel Cat" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Save changes" }));

  expect(mocks.updateUser).toHaveBeenCalledWith({
    name: "Pixel Cat",
  });

  mocks.captured.updateUser?.onError?.({
    error: { message: "Unable to update profile" },
  });

  expect(toast.toastError).toHaveBeenCalledWith("Unable to update profile");
});

test("submits usernames without displayUsername when that feature is disabled", async () => {
  const mocks = setupBetterAuthUiMocks({
    auth: {
      username: {
        enabled: true,
        displayUsername: false,
        isUsernameAvailable: false,
      },
    },
  });
  vi.doMock("~/components/settings/account/change-avatar", () => ({
    ChangeAvatar: () => <div data-testid="change-avatar" />,
  }));
  const { UserProfile } = await import(
    "~/components/settings/account/user-profile"
  );

  render(<UserProfile />);

  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "pixelcat" },
  });
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Pixel Cat" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Save changes" }));

  expect(mocks.updateUser).toHaveBeenCalledWith({
    name: "Pixel Cat",
    username: "pixelcat",
  });
});

test("shows unavailable username feedback and the pending save spinner", async () => {
  setupBetterAuthUiMocks({
    auth: {
      username: {
        enabled: true,
        isUsernameAvailable: true,
      },
    },
    pending: {
      updateUser: true,
    },
    username: {
      data: {
        available: false,
      },
    },
  });
  vi.doMock("~/components/settings/account/change-avatar", () => ({
    ChangeAvatar: () => <div data-testid="change-avatar" />,
  }));
  const { UserProfile } = await import(
    "~/components/settings/account/user-profile"
  );

  render(<UserProfile />);

  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "taken-name" },
  });

  expect(screen.getByText("Username is already taken")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});
