import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  createMockSession,
  mockSonnerToast,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

function mockDropdownMenu() {
  vi.doMock("~/components/ui/dropdown-menu", () => ({
    DropdownMenu: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DropdownMenuContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DropdownMenuItem: ({
      children,
      disabled,
      onClick,
    }: {
      children: ReactNode;
      disabled?: boolean;
      onClick?: () => void;
    }) => (
      <button disabled={disabled} onClick={onClick} type="button">
        {children}
      </button>
    ),
    DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
  }));
  vi.doMock("~/components/user/user-avatar", () => ({
    UserAvatar: ({ isPending }: { isPending?: boolean }) => (
      <div data-testid="user-avatar" data-pending={String(!!isPending)} />
    ),
  }));
}

beforeEach(() => {
  vi.resetModules();
});

test("uploads a new avatar and forwards the success callback", async () => {
  const toast = mockSonnerToast();
  const resize = vi.fn(async (file: File) => file);
  const upload = vi.fn(async () => "https://cdn.openkitten.dev/avatar.webp");
  const mocks = setupBetterAuthUiMocks({
    auth: {
      avatar: {
        delete: vi.fn(async () => undefined),
        extension: "webp",
        resize,
        size: 256,
        upload,
      },
    },
  });
  mockDropdownMenu();
  const { ChangeAvatar } = await import(
    "~/components/settings/account/change-avatar"
  );

  const { container } = render(<ChangeAvatar />);
  const input = container.querySelector('input[type="file"]');

  expect(input).not.toBeNull();

  fireEvent.change(input ?? document.createElement("input"), {
    target: {
      files: [new File(["meow"], "avatar.png", { type: "image/png" })],
    },
  });

  await waitFor(() => {
    expect(resize).toHaveBeenCalled();
  });
  expect(upload).toHaveBeenCalled();
  expect(mocks.updateUser).toHaveBeenCalledWith(
    { image: "https://cdn.openkitten.dev/avatar.webp" },
    expect.objectContaining({
      onSuccess: expect.any(Function),
    }),
  );

  const uploadOptions = mocks.updateUser.mock.calls[0]?.[1];
  await uploadOptions?.onSuccess?.();

  expect(toast.toastSuccess).toHaveBeenCalledWith("Avatar updated");
});

test("falls back to fileToBase64 when no custom upload hook is configured", async () => {
  const mocks = setupBetterAuthUiMocks({
    auth: {
      avatar: {
        delete: vi.fn(async () => undefined),
        extension: "webp",
        resize: undefined,
        size: 256,
        upload: undefined,
      },
    },
  });
  mockDropdownMenu();
  const { ChangeAvatar } = await import(
    "~/components/settings/account/change-avatar"
  );

  const { container } = render(<ChangeAvatar />);
  const input = container.querySelector('input[type="file"]');

  fireEvent.change(input ?? document.createElement("input"), {
    target: {
      files: [new File(["meow"], "avatar.png", { type: "image/png" })],
    },
  });

  await waitFor(() => {
    expect(mocks.fileToBase64).toHaveBeenCalled();
  });
  expect(mocks.updateUser).toHaveBeenCalledWith(
    { image: "data:image/webp;base64,openkitten" },
    expect.objectContaining({
      onSuccess: expect.any(Function),
    }),
  );
});

test("deletes the existing avatar asset after the user record updates", async () => {
  const toast = mockSonnerToast();
  const deleteAvatar = vi.fn(async () => undefined);
  const mocks = setupBetterAuthUiMocks({
    auth: {
      avatar: {
        delete: deleteAvatar,
        extension: "webp",
        resize: vi.fn(async (file: File) => file),
        size: 256,
        upload: vi.fn(async () => "unused"),
      },
    },
    session: createMockSession({
      user: {
        image: "https://cdn.openkitten.dev/current.webp",
      },
    }),
  });
  mockDropdownMenu();
  const { ChangeAvatar } = await import(
    "~/components/settings/account/change-avatar"
  );

  render(<ChangeAvatar />);

  fireEvent.click(screen.getByRole("button", { name: "Delete avatar" }));

  expect(mocks.updateUser).toHaveBeenCalledWith(
    { image: null },
    expect.objectContaining({
      onSuccess: expect.any(Function),
    }),
  );

  const deleteOptions = mocks.updateUser.mock.calls[0]?.[1];
  await deleteOptions?.onSuccess?.();

  expect(deleteAvatar).toHaveBeenCalledWith(
    "https://cdn.openkitten.dev/current.webp",
  );
  expect(toast.toastSuccess).toHaveBeenCalledWith("Avatar removed");
});

test("reports avatar upload errors", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks({
    auth: {
      avatar: {
        delete: vi.fn(async () => undefined),
        extension: "webp",
        resize: vi.fn(async () => {
          throw new Error("Upload failed");
        }),
        size: 256,
        upload: vi.fn(async () => "unused"),
      },
    },
  });
  mockDropdownMenu();
  const { ChangeAvatar } = await import(
    "~/components/settings/account/change-avatar"
  );

  const { container } = render(<ChangeAvatar />);
  const input = container.querySelector('input[type="file"]');

  fireEvent.change(input ?? document.createElement("input"), {
    target: {
      files: [new File(["meow"], "avatar.png", { type: "image/png" })],
    },
  });

  await waitFor(() => {
    expect(toast.toastError).toHaveBeenCalledWith("Upload failed");
  });
  expect(mocks.updateUser).not.toHaveBeenCalled();
});

test("ignores non-Error avatar upload failures", async () => {
  const toast = mockSonnerToast();
  setupBetterAuthUiMocks({
    auth: {
      avatar: {
        delete: vi.fn(async () => undefined),
        extension: "webp",
        resize: vi.fn(async () => {
          throw {};
        }),
        size: 256,
        upload: vi.fn(async () => "unused"),
      },
    },
  });
  mockDropdownMenu();
  const { ChangeAvatar } = await import(
    "~/components/settings/account/change-avatar"
  );

  const { container } = render(<ChangeAvatar />);
  const input = container.querySelector('input[type="file"]');

  fireEvent.change(input ?? document.createElement("input"), {
    target: {
      files: [new File(["meow"], "avatar.png", { type: "image/png" })],
    },
  });

  await waitFor(() => {
    expect(toast.toastError).not.toHaveBeenCalled();
  });
});

test("ignores empty file selections and forwards update errors", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks();
  mockDropdownMenu();
  const { ChangeAvatar } = await import(
    "~/components/settings/account/change-avatar"
  );

  const { container } = render(<ChangeAvatar />);
  const input = container.querySelector('input[type="file"]');

  fireEvent.change(input ?? document.createElement("input"), {
    target: {
      files: [],
    },
  });

  expect(mocks.updateUser).not.toHaveBeenCalled();

  mocks.captured.updateUser?.onError?.({
    error: { message: "Unable to update avatar" },
  });

  expect(toast.toastError).toHaveBeenCalledWith("Unable to update avatar");
});

test("clicks the hidden file input from both avatar triggers", async () => {
  const inputClick = vi
    .spyOn(HTMLInputElement.prototype, "click")
    .mockImplementation(() => {});
  setupBetterAuthUiMocks();
  mockDropdownMenu();
  const { ChangeAvatar } = await import(
    "~/components/settings/account/change-avatar"
  );

  render(<ChangeAvatar />);

  const avatarButton = screen.getByTestId("user-avatar").closest("button");

  expect(avatarButton).not.toBeNull();
  fireEvent.click(avatarButton ?? document.body);
  fireEvent.click(screen.getByRole("button", { name: "Upload avatar" }));

  expect(inputClick).toHaveBeenCalledTimes(2);
});

test("skips deleting the remote avatar when there is no current image", async () => {
  const deleteAvatar = vi.fn(async () => undefined);
  setupBetterAuthUiMocks({
    auth: {
      avatar: {
        delete: deleteAvatar,
      },
    },
    session: createMockSession({
      user: {
        image: null,
      },
    }),
  });
  mockDropdownMenu();
  const { ChangeAvatar } = await import(
    "~/components/settings/account/change-avatar"
  );

  render(<ChangeAvatar />);

  expect(screen.getByRole("button", { name: "Delete avatar" })).toBeDisabled();

  expect(deleteAvatar).not.toHaveBeenCalled();
});
