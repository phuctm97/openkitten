import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const mockRPCLink = vi.fn();
const mockCreateORPCClient = vi.fn().mockReturnValue({ getBotToken: vi.fn() });

vi.mock("@orpc/client", () => ({
  createORPCClient: (...args: unknown[]) => mockCreateORPCClient(...args),
}));
vi.mock("@orpc/client/fetch", () => ({
  RPCLink: mockRPCLink,
}));

let tmpDir: string;
let originalXdgState: string | undefined;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "create-bot-client-"));
  originalXdgState = Bun.env["XDG_STATE_HOME"];
});

afterEach(async () => {
  mockRPCLink.mockReset();
  mockCreateORPCClient.mockReset();
  mockCreateORPCClient.mockReturnValue({ getBotToken: vi.fn() });
  vi.resetModules();
  Bun.env["XDG_STATE_HOME"] = originalXdgState;
  await rm(tmpDir, { recursive: true });
});

async function writeConfig(stateDir: string): Promise<void> {
  await mkdir(join(stateDir, "openkitten"), { recursive: true });
  await Bun.write(
    join(stateDir, "openkitten", "bot-api.json"),
    JSON.stringify({ url: "http://127.0.0.1:12345/rpc", token: "test-token" }),
  );
}

test("creates client with RPCLink from config", async () => {
  const stateDir = join(tmpDir, "state");
  await writeConfig(stateDir);
  Bun.env["XDG_STATE_HOME"] = stateDir;
  const { createOpenKittenBotClient } = await import(
    "../lib/create-bot-client"
  );
  await createOpenKittenBotClient();
  const call = mockRPCLink.mock.calls[0] as never as [
    { url: string; headers: () => Record<string, string> },
  ];
  const options = call[0];
  expect(options.url).toBe("http://127.0.0.1:12345/rpc");
  expect(options.headers()).toEqual({
    authorization: "Bearer test-token",
  });
  expect(mockCreateORPCClient).toHaveBeenCalledOnce();
});

test("throws when config missing", async () => {
  Bun.env["XDG_STATE_HOME"] = join(tmpDir, "missing");
  const { createOpenKittenBotClient } = await import(
    "../lib/create-bot-client"
  );
  await expect(createOpenKittenBotClient()).rejects.toThrow();
});
