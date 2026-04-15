import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { OpenkittenContext } from "../lib/openkitten-context";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "openkitten-ctx-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true });
});

async function writeBotAPIConfig(stateDir: string): Promise<void> {
  await mkdir(join(stateDir, "openkitten"), { recursive: true });
  await Bun.write(
    join(stateDir, "openkitten", "bot-api.json"),
    JSON.stringify({ url: "http://127.0.0.1:12345/rpc", token: "test-token" }),
  );
}

test("creates context with api client", async () => {
  const stateDir = join(tmpDir, "state");
  await writeBotAPIConfig(stateDir);
  const ctx = await OpenkittenContext.create(stateDir);
  expect(ctx.api).toBeDefined();
  expect(ctx.api.getBotToken).toBeDefined();
});

test("throws ConfigNotFoundError when bot-api.json missing", async () => {
  const stateDir = join(tmpDir, "no-state");
  await expect(OpenkittenContext.create(stateDir)).rejects.toBeInstanceOf(
    OpenkittenContext.ConfigNotFoundError,
  );
});

test("ConfigNotFoundError has path property", () => {
  const err = new OpenkittenContext.ConfigNotFoundError("/test/path");
  expect(err.path).toBe("/test/path");
  expect(err.message).toContain("/test/path");
});
