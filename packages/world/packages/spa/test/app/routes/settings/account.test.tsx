import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
}));

vi.mock("~/lib/authenticate", () => ({
  authenticate: mocks.authenticate,
}));

vi.mock("~/components/settings/settings", () => ({
  Settings: ({ view }: { view: string }) => (
    <div data-testid="settings" data-view={view} />
  ),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

test("clientLoader authenticates and returns null", async () => {
  mocks.authenticate.mockResolvedValueOnce(undefined);
  const { clientLoader } = await import("~/app/routes/settings/account");

  await expect(
    clientLoader({
      request: new Request("http://localhost/settings/account"),
    } as never),
  ).resolves.toBeNull();
  expect(mocks.authenticate).toHaveBeenCalledWith(
    "http://localhost/settings/account",
  );
});

test("renders the Settings panel with view=account", async () => {
  const { default: Component } = await import("~/app/routes/settings/account");

  render(<Component />);

  expect(screen.getByTestId("settings")).toHaveAttribute(
    "data-view",
    "account",
  );
});
