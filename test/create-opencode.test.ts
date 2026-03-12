import { expect, test, vi } from "vitest";
import { createOpenCode } from "~/lib/create-opencode";
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
      }) as never,
  );
}

test("createOpenCode parses port", async () => {
  mockSpawn();
  const opencode = await createOpenCode();
  expect(opencode.port).toBe(3000);
});

test("createOpenCode is async disposable", async () => {
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
      }) as never,
  );
  {
    await using _opencode = await createOpenCode();
  }
  expect(kill).toHaveBeenCalledOnce();
});

test("createOpenCode throws if port not found", async () => {
  mockSpawn("no port here\n");
  await expect(createOpenCode()).rejects.toThrow(
    "opencode exited without announcing port",
  );
});

test("createOpenCode throws if listening line has no port", async () => {
  mockSpawn("listening\n");
  await expect(createOpenCode()).rejects.toThrow(
    "opencode exited without announcing port",
  );
});
