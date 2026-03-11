import { runCommand } from "citty";
import { expect, test, vi } from "vitest";
import serve from "~/lib/serve";

function mockSpawn() {
  const kill = vi.fn();
  const spawn = vi
    .spyOn(Bun, "spawn")
    .mockImplementation(() => ({ kill, exited: Promise.resolve(0) }) as never);
  return { kill, spawn };
}

test("serve runs", async () => {
  const { spawn } = mockSpawn();
  await expect(runCommand(serve, { rawArgs: [] })).resolves.not.toThrow();
  expect(spawn).toHaveBeenCalledOnce();
});

test("serve kills subprocess on SIGINT", async () => {
  const { kill } = mockSpawn();
  await runCommand(serve, { rawArgs: [] });
  process.emit("SIGINT");
  expect(kill).toHaveBeenCalledOnce();
});
