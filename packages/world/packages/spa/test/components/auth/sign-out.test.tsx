import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  mockSonnerToast,
  setupBetterAuthUiMocks,
} from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

test("signs out only once and redirects back to sign-in on success", async () => {
  mockSonnerToast();
  const mocks = setupBetterAuthUiMocks();
  const { SignOut } = await import("~/components/auth/sign-out");

  const { rerender } = render(
    <StrictMode>
      <SignOut className="centered" />
    </StrictMode>,
  );

  rerender(
    <StrictMode>
      <SignOut className="centered" />
    </StrictMode>,
  );

  expect(mocks.signOut).toHaveBeenCalledTimes(1);

  mocks.captured.signOut?.onSuccess?.();

  expect(mocks.auth.navigate).toHaveBeenCalledWith({
    replace: true,
    to: "/auth/sign-in",
  });
});

test("shows an error toast and redirects when sign-out fails", async () => {
  const toast = mockSonnerToast();
  const mocks = setupBetterAuthUiMocks();
  const { SignOut } = await import("~/components/auth/sign-out");

  render(<SignOut />);

  mocks.captured.signOut?.onError?.({
    message: "Fallback sign-out failure",
  });
  mocks.captured.signOut?.onError?.({
    error: { message: "Unable to sign out" },
  });

  expect(toast.toastError).toHaveBeenCalledWith("Fallback sign-out failure");
  expect(toast.toastError).toHaveBeenCalledWith("Unable to sign out");
  expect(mocks.auth.navigate).toHaveBeenCalledWith({
    replace: true,
    to: "/auth/sign-in",
  });
});
