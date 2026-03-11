import { runCommand } from "citty";
import { expect, test, vi } from "vitest";
import serve from "~/lib/serve";
import { textEncoder } from "~/lib/text-encoder";

function mockSpawn(portLine = "listening on :3000\n") {
  const kill = vi.fn();
  const stdout = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(textEncoder.encode(portLine));
      controller.close();
    },
  });
  const spawn = vi.spyOn(Bun, "spawn").mockImplementation(
    () =>
      ({
        kill,
        stdout,
        stderr: new ReadableStream({ start: (c) => c.close() }),
        exited: Promise.resolve(0),
      }) as never,
  );
  return { kill, spawn };
}

test("serve runs and parses port", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  const { spawn } = mockSpawn();
  await expect(runCommand(serve, { rawArgs: [] })).resolves.not.toThrow();
  expect(spawn).toHaveBeenCalledOnce();
  expect(console.log).toHaveBeenCalledWith(
    "opencode is listening on port 3000",
  );
});

test("serve kills subprocess on SIGINT", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  const { kill } = mockSpawn();
  await runCommand(serve, { rawArgs: [] });
  process.emit("SIGINT");
  expect(kill).toHaveBeenCalledOnce();
});

test("serve throws if port not found", async () => {
  mockSpawn("no port here\n");
  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    "opencode exited without announcing port",
  );
});

test("serve throws if listening line has no port", async () => {
  mockSpawn("listening\n");
  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    "opencode exited without announcing port",
  );
});
