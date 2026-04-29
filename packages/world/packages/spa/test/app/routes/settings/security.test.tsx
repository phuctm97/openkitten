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
  const { clientLoader } = await import("~/app/routes/settings/security");

  await expect(
    clientLoader({
      request: new Request("http://localhost/settings/security"),
    } as never),
  ).resolves.toBeNull();
  expect(mocks.authenticate).toHaveBeenCalledWith(
    "http://localhost/settings/security",
  );
});

test("renders the Settings panel with view=security", async () => {
  const { default: Component } = await import("~/app/routes/settings/security");

  render(<Component />);

  expect(screen.getByTestId("settings")).toHaveAttribute(
    "data-view",
    "security",
  );
});
