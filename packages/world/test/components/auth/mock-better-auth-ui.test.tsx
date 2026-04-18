import { expect, test, vi } from "vitest";

import { setupBetterAuthUiMocks } from "~/test/components/auth/mock-better-auth-ui";

test("uses a provided navigate override and exposes callable default avatar helpers", async () => {
  const navigate =
    vi.fn<(options: { replace?: boolean; to: string }) => void>();
  const mocks = setupBetterAuthUiMocks({
    auth: {
      navigate,
    },
  });
  const file = new File(["meow"], "avatar.png", { type: "image/png" });

  Reflect.apply(mocks.auth.navigate as never, undefined, [{ to: "/castle" }]);

  expect(navigate).toHaveBeenCalledWith({ to: "/castle" });
  expect(
    await Reflect.apply(mocks.auth.avatar.resize as never, undefined, [
      file,
      256,
      "webp",
    ]),
  ).toBe(file);
  expect(
    await Reflect.apply(mocks.auth.avatar.upload as never, undefined, [file]),
  ).toBe("data:image/webp;base64,openkitten");
  await expect(
    Reflect.apply(mocks.auth.avatar.delete as never, undefined, [
      "https://cdn.openkitten.dev/avatar.webp",
    ]),
  ).resolves.toBeUndefined();
});
