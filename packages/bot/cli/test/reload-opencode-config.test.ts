import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { builtinCommands } from "~/lib/builtin-commands";

vi.mock("~/lib/grammy-set-commands");

let tempDir: string;

beforeEach(async () => {
  vi.resetAllMocks();
  tempDir = await mkdtemp(join(tmpdir(), "reload-opencode-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function callReload(commandsDir: string) {
  const { reloadOpencodeConfig } = await import("~/lib/reload-opencode-config");
  await reloadOpencodeConfig({
    commandsDir,
    botToken: "test-token",
  });
}

async function getFirstCall() {
  const { grammySetCommands } = await import("~/lib/grammy-set-commands");
  const mock = vi.mocked(grammySetCommands);
  expect(mock).toHaveBeenCalledOnce();
  const call = mock.mock.lastCall as [
    string,
    readonly { command: string; description: string }[],
  ];
  return { token: call[0], commands: call[1] };
}

test("registers only builtins when commands dir is empty", async () => {
  await callReload(tempDir);
  const { token, commands } = await getFirstCall();
  expect(token).toBe("test-token");
  expect(commands).toEqual([...builtinCommands]);
});

test("parses descriptions from frontmatter in .md files", async () => {
  await writeFile(
    join(tempDir, "deploy.md"),
    "---\ndescription: Deploy the app\n---\nContent",
  );
  await callReload(tempDir);
  const { commands } = await getFirstCall();
  const custom = commands.find((c) => c.command === "deploy");
  expect(custom).toEqual({ command: "deploy", description: "Deploy the app" });
});

test("skips non-.md files", async () => {
  await writeFile(join(tempDir, "readme.txt"), "not a command");
  await writeFile(
    join(tempDir, "hello.md"),
    "---\ndescription: Say hello\n---\n",
  );
  await callReload(tempDir);
  const { commands } = await getFirstCall();
  const names = commands.map((c) => c.command);
  expect(names).not.toContain("readme");
  expect(names).toContain("hello");
});

test("defaults description to empty string when no frontmatter", async () => {
  await writeFile(
    join(tempDir, "bare.md"),
    "Just some text without front matter",
  );
  await callReload(tempDir);
  const { commands } = await getFirstCall();
  const custom = commands.find((c) => c.command === "bare");
  expect(custom).toEqual({ command: "bare", description: "" });
});

test("sorts custom commands alphabetically", async () => {
  await writeFile(join(tempDir, "zebra.md"), "---\ndescription: Z\n---\n");
  await writeFile(join(tempDir, "alpha.md"), "---\ndescription: A\n---\n");
  await callReload(tempDir);
  const { commands } = await getFirstCall();
  const customNames = commands
    .filter((c) => !builtinCommands.some((b) => b.command === c.command))
    .map((c) => c.command);
  expect(customNames).toEqual(["alpha", "zebra"]);
});

test("falls back to empty when directory does not exist", async () => {
  await callReload(join(tempDir, "nonexistent"));
  const { commands } = await getFirstCall();
  expect(commands).toEqual([...builtinCommands]);
});
