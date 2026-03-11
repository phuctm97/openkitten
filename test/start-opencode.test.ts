import { expect, test, vi } from "vitest";
import { startOpenCode } from "~/lib/start-opencode";
import { textEncoder } from "~/lib/text-encoder";

function mockSpawn(portLine = "listening on :3000\n") {
  const kill = vi.fn();
  const stdout = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(textEncoder.encode(portLine));
      controller.close();
    },
  });
  return vi.spyOn(Bun, "spawn").mockImplementation(
    () =>
      ({
        kill,
        stdout,
        stderr: new ReadableStream({ start: (c) => c.close() }),
        exited: Promise.resolve(0),
      }) as never,
  );
}

test("startOpenCode parses port", async () => {
  mockSpawn();
  const opencode = await startOpenCode();
  expect(opencode.port).toBe(3000);
});

test("startOpenCode is async disposable", async () => {
  const kill = vi.fn();
  vi.spyOn(Bun, "spawn").mockImplementation(
    () =>
      ({
        kill,
        stdout: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(textEncoder.encode("listening on :3000\n"));
            controller.close();
          },
        }),
        stderr: new ReadableStream({ start: (c) => c.close() }),
        exited: Promise.resolve(0),
      }) as never,
  );
  {
    await using _opencode = await startOpenCode();
  }
  expect(kill).toHaveBeenCalledOnce();
});

test("startOpenCode kills on SIGINT", async () => {
  const spawn = mockSpawn();
  await startOpenCode();
  process.emit("SIGINT");
  const mock = spawn.mock.results[0]?.value;
  expect(mock.kill).toHaveBeenCalledOnce();
});

test("startOpenCode throws if port not found", async () => {
  mockSpawn("no port here\n");
  await expect(startOpenCode()).rejects.toThrow(
    "opencode exited without announcing port",
  );
});

test("startOpenCode throws if listening line has no port", async () => {
  mockSpawn("listening\n");
  await expect(startOpenCode()).rejects.toThrow(
    "opencode exited without announcing port",
  );
});
