import { expect, test, vi } from "vitest";

vi.mock("citty", () => ({
  defineCommand: vi.fn((cmd: unknown) => cmd),
  runMain: vi.fn(),
}));

test("runs cli", async () => {
  const { runMain } = await import("citty");
  const { cli } = await import("~/lib/cli");
  await import("~/lib/main");
  expect(runMain).toHaveBeenCalledWith(cli);
});
