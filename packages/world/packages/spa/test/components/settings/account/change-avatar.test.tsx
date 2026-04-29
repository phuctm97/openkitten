import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function mockUserAvatar() {
  vi.doMock("~/components/user/user-avatar", () => ({
    UserAvatar: ({ isPending }: { isPending?: boolean }) => (
      <div
        data-testid="user-avatar"
        data-pending={String(Boolean(isPending))}
      />
    ),
  }));
}

test("uploads a resized avatar via the configured upload helper", async () => {
  const sonner = mockSonner();
  const resize = vi.fn(async (file: File) => new File([file], "resized.png"));
  const upload = vi.fn(async () => "https://cdn/avatar.png");
  const mocks = setupSettingsMocks({
    auth: {
      avatar: { delete: vi.fn(), extension: "png", resize, size: 256, upload },
    },
  });
  mockUserAvatar();
  const { ChangeAvatar } = await import(
    "~/components/settings/account/change-avatar"
  );

  const { container } = render(<ChangeAvatar className="avatar" />);

  const file = new File(["hi"], "kitten.png", { type: "image/png" });
  const input = container.querySelector(
    "input[type='file']",
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });

  await waitFor(() => {
    expect(resize).toHaveBeenCalledWith(file, 256, "png");
  });
  await waitFor(() => {
    expect(upload).toHaveBeenCalled();
  });
  await waitFor(() => {
    expect(mocks.updateUser).toHaveBeenCalledWith(
      { image: "https://cdn/avatar.png" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  const updateOptions = mocks.updateUser.mock.calls[0]?.[1] as
    | { onSuccess: () => void }
    | undefined;
  updateOptions?.onSuccess();
  expect(sonner.toastSuccess).toHaveBeenCalledWith("Avatar updated");
});

test("falls back to fileToBase64 when no upload helper is configured", async () => {
  mockSonner();
  const mocks = setupSettingsMocks({
    auth: {
      avatar: {
        delete: undefined,
        extension: "png",
        resize: undefined,
        size: 256,
        upload: undefined,
      },
    },
  });
  mockUserAvatar();
  const { ChangeAvatar } = await import(
    "~/components/settings/account/change-avatar"
  );

  const { container } = render(<ChangeAvatar />);

  const file = new File(["hi"], "kitten.png", { type: "image/png" });
  const input = container.querySelector(
    "input[type='file']",
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });

  await waitFor(() => {
    expect(mocks.updateUser).toHaveBeenCalledWith(
      { image: "base64:kitten.png" },
      expect.any(Object),
    );
  });
});

test("returns early when no file is selected", async () => {
  mockSonner();
  const mocks = setupSettingsMocks();
  mockUserAvatar();
  const { ChangeAvatar } = await import(
    "~/components/settings/account/change-avatar"
  );

  const { container } = render(<ChangeAvatar />);

  const input = container.querySelector(
    "input[type='file']",
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [] } });

  expect(mocks.updateUser).not.toHaveBeenCalled();
});

test("shows a toast error when the resize helper throws an Error", async () => {
  const sonner = mockSonner();
  const resize = vi.fn(async () => {
    throw new Error("Resize failed");
  });
  setupSettingsMocks({
    auth: {
      avatar: {
        delete: vi.fn(),
        extension: "png",
        resize,
        size: 256,
        upload: vi.fn(),
      },
    },
  });
  mockUserAvatar();
  const { ChangeAvatar } = await import(
    "~/components/settings/account/change-avatar"
  );

  const { container } = render(<ChangeAvatar />);

  const file = new File(["hi"], "kitten.png", { type: "image/png" });
  const input = container.querySelector(
    "input[type='file']",
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });

  await waitFor(() => {
    expect(sonner.toastError).toHaveBeenCalledWith("Resize failed");
  });
});

test("ignores non-Error throws from resize", async () => {
  const sonner = mockSonner();
  const resize = vi.fn(async () => {
    throw "boom";
  });
  setupSettingsMocks({
    auth: {
      avatar: {
        delete: vi.fn(),
        extension: "png",
        resize,
        size: 256,
        upload: vi.fn(),
      },
    },
  });
  mockUserAvatar();
  const { ChangeAvatar } = await import(
    "~/components/settings/account/change-avatar"
  );

  const { container } = render(<ChangeAvatar />);

  const file = new File(["hi"], "kitten.png", { type: "image/png" });
  const input = container.querySelector(
    "input[type='file']",
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });

  await waitFor(() => {
    expect(resize).toHaveBeenCalled();
  });
  expect(sonner.toastError).not.toHaveBeenCalled();
});

test("clicking the avatar trigger forwards to the hidden file input", async () => {
  mockSonner();
  setupSettingsMocks();
  mockUserAvatar();
  const { ChangeAvatar } = await import(
    "~/components/settings/account/change-avatar"
  );

  const { container } = render(<ChangeAvatar />);

  const fileInput = container.querySelector(
    "input[type='file']",
  ) as HTMLInputElement;
  const clickSpy = vi.spyOn(fileInput, "click");

  const avatarButton = screen.getByTestId("user-avatar")
    .parentElement as HTMLButtonElement;
  fireEvent.click(avatarButton);
  expect(clickSpy).toHaveBeenCalled();
});

test("opens the dropdown menu and uploads via the upload menu item", async () => {
  mockSonner();
  setupSettingsMocks();
  mockUserAvatar();
  const { ChangeAvatar } = await import(
    "~/components/settings/account/change-avatar"
  );

  const { container } = render(<ChangeAvatar />);

  const fileInput = container.querySelector(
    "input[type='file']",
  ) as HTMLInputElement;
  const clickSpy = vi.spyOn(fileInput, "click");

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Change avatar/u }));

  await user.click(
    await screen.findByRole("menuitem", { name: /Upload avatar/u }),
  );

  expect(clickSpy).toHaveBeenCalled();
});

test("deletes the current avatar and runs the avatar.delete cleanup", async () => {
  const sonner = mockSonner();
  const deleteAvatar = vi.fn(async () => {});
  const mocks = setupSettingsMocks({
    auth: {
      avatar: {
        delete: deleteAvatar,
        extension: "png",
        resize: vi.fn(),
        size: 256,
        upload: vi.fn(),
      },
    },
    session: {
      session: { ...defaultSession.session, id: "s", token: "t", userId: "u" },
      user: {
        ...defaultSession.user,
        email: "u@kitten.dev",
        emailVerified: true,
        id: "u",
        image: "https://cdn/old.png",
        name: "Old",
      },
    },
  });
  mockUserAvatar();
  const { ChangeAvatar } = await import(
    "~/components/settings/account/change-avatar"
  );

  render(<ChangeAvatar />);

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Change avatar/u }));

  await user.click(
    await screen.findByRole("menuitem", { name: /Delete avatar/u }),
  );

  expect(mocks.updateUser).toHaveBeenCalledWith(
    { image: null },
    expect.any(Object),
  );

  const updateOptions = mocks.updateUser.mock.calls[0]?.[1] as
    | { onSuccess: () => Promise<void> }
    | undefined;
  await updateOptions?.onSuccess();
  expect(deleteAvatar).toHaveBeenCalledWith("https://cdn/old.png");
  expect(sonner.toastSuccess).toHaveBeenCalledWith("Avatar deleted");
});

test("skips the delete cleanup when the user had no avatar", async () => {
  const sonner = mockSonner();
  const deleteAvatar = vi.fn();
  const mocks = setupSettingsMocks({
    auth: {
      avatar: {
        delete: deleteAvatar,
        extension: "png",
        resize: vi.fn(),
        size: 256,
        upload: vi.fn(),
      },
    },
  });
  mockUserAvatar();
  const { ChangeAvatar } = await import(
    "~/components/settings/account/change-avatar"
  );

  render(<ChangeAvatar />);

  const user = userEvent.setup({ pointerEventsCheck: 0 });
  await user.click(screen.getByRole("button", { name: /Change avatar/u }));

  const deleteItem = await screen.findByRole("menuitem", {
    name: /Delete avatar/u,
  });
  expect(deleteItem).toHaveAttribute("aria-disabled", "true");
  await user.click(deleteItem);

  if (mocks.updateUser.mock.calls.length > 0) {
    const updateOptions = mocks.updateUser.mock.calls[0]?.[1] as
      | { onSuccess: () => Promise<void> }
      | undefined;
    await updateOptions?.onSuccess();
    expect(deleteAvatar).not.toHaveBeenCalled();
    expect(sonner.toastSuccess).toHaveBeenCalledWith("Avatar deleted");
  }
});

test("disables the change-avatar button when there is no session", async () => {
  mockSonner();
  setupSettingsMocks({ session: null });
  mockUserAvatar();
  const { ChangeAvatar } = await import(
    "~/components/settings/account/change-avatar"
  );

  render(<ChangeAvatar />);

  expect(screen.getByRole("button", { name: /Change avatar/u })).toBeDisabled();
});
