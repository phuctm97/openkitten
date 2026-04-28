import { afterEach, expect, test, vi } from "vitest";

const authenticateMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  produceCallback: vi.fn(),
  replace: vi.fn((to: string) => {
    return new Response(null, {
      headers: { Location: to },
      status: 302,
    });
  }),
}));

vi.mock("react-router", () => ({
  replace: authenticateMocks.replace,
}));

vi.mock("~/lib/get-session", () => ({
  getSession: authenticateMocks.getSession,
}));

vi.mock("~/lib/produce-callback", () => ({
  produceCallback: authenticateMocks.produceCallback,
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

test("redirects to sign-in when no session is found", async () => {
  authenticateMocks.getSession.mockResolvedValue(null);
  const { authenticate } = await import("~/lib/authenticate");

  await expect(
    authenticate("https://world.openkitten.dev/app?tab=home"),
  ).rejects.toMatchObject({ status: 302 });

  expect(authenticateMocks.produceCallback).toHaveBeenCalledWith(
    "https://world.openkitten.dev/app?tab=home",
  );
  expect(authenticateMocks.replace).toHaveBeenCalledWith("/auth/sign-in");
});

test("redirects to verify-email when the session is unverified", async () => {
  authenticateMocks.getSession.mockResolvedValue({
    user: { id: "user-1", emailVerified: false },
  });
  const { authenticate } = await import("~/lib/authenticate");

  await expect(
    authenticate("https://world.openkitten.dev/app"),
  ).rejects.toMatchObject({ status: 302 });

  expect(authenticateMocks.produceCallback).toHaveBeenCalledWith(
    "https://world.openkitten.dev/app",
  );
  expect(authenticateMocks.replace).toHaveBeenCalledWith("/auth/verify-email");
});

test("returns the session when the user is verified", async () => {
  const session = { user: { id: "user-1", emailVerified: true } };
  authenticateMocks.getSession.mockResolvedValue(session);
  const { authenticate } = await import("~/lib/authenticate");

  await expect(authenticate("https://world.openkitten.dev/app")).resolves.toBe(
    session,
  );

  expect(authenticateMocks.produceCallback).not.toHaveBeenCalled();
  expect(authenticateMocks.replace).not.toHaveBeenCalled();
});
