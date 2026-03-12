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
        exited: Promise.resolve(0),
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
        exited: Promise.resolve(0),
      }) as never,
  );
  {
    await using _opencode = await createOpenCode();
  }
  expect(kill).toHaveBeenCalledOnce();
});

test("createOpenCode.exited rejects on unexpected exit", async () => {
  mockSpawn();
  const opencode = await createOpenCode();
  await expect(opencode.exited).rejects.toThrow(
    "opencode exited unexpectedly with code 0",
  );
});

test("createOpenCode.exited does not reject after dispose", async () => {
  let resolveExited: (code: number) => void;
  const exited = new Promise<number>((r) => {
    resolveExited = r;
  });
  vi.spyOn(Bun, "spawn").mockImplementation(
    () =>
      ({
        kill: vi.fn(() => resolveExited(0)),
        stdout: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(textEncoder.encode("listening on :3000\n"));
            controller.close();
          },
        }),
        stderr: new ReadableStream({ start: (c) => c.close() }),
        exited,
      }) as never,
  );
  const opencode = await createOpenCode();
  await opencode[Symbol.asyncDispose]();
  await expect(opencode.exited).resolves.toBeUndefined();
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
