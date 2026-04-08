import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { CommandSkills } from "~/lib/command-skills";

let skillsDir: string;

beforeEach(async () => {
  skillsDir = await mkdtemp(join(tmpdir(), "command-skills-"));
});

afterEach(async () => {
  await rm(skillsDir, { recursive: true, force: true });
});

test("create writes SKILL.md and command.json", async () => {
  const command = await CommandSkills.create(skillsDir, {
    name: "translate",
    description: "Translate text to English",
    prompt: "Translate the following text to English.",
  });
  expect(command).toEqual({
    name: "translate",
    description: "Translate text to English",
    prompt: "Translate the following text to English.",
  });

  const skillMd = await readFile(
    join(skillsDir, "translate", "SKILL.md"),
    "utf-8",
  );
  expect(skillMd).toContain("name: command-translate");
  expect(skillMd).toContain("/translate");
  expect(skillMd).toContain("Translate the following text to English.");

  const commandJson = JSON.parse(
    await readFile(join(skillsDir, "translate", "command.json"), "utf-8"),
  );
  expect(commandJson).toEqual({
    name: "translate",
    description: "Translate text to English",
    prompt: "Translate the following text to English.",
  });
});

test("create throws ReservedError for builtin names", async () => {
  await expect(
    CommandSkills.create(skillsDir, {
      name: "start",
      description: "D",
      prompt: "P",
    }),
  ).rejects.toThrow(CommandSkills.ReservedError);
});

test("create throws DuplicateError for existing command", async () => {
  await CommandSkills.create(skillsDir, {
    name: "translate",
    description: "D",
    prompt: "P",
  });
  await expect(
    CommandSkills.create(skillsDir, {
      name: "translate",
      description: "D2",
      prompt: "P2",
    }),
  ).rejects.toThrow(CommandSkills.DuplicateError);
});

test("create throws for invalid name", async () => {
  await expect(
    CommandSkills.create(skillsDir, {
      name: "123invalid",
      description: "D",
      prompt: "P",
    }),
  ).rejects.toThrow("Invalid command name");
});

test("create throws for uppercase name", async () => {
  await expect(
    CommandSkills.create(skillsDir, {
      name: "Translate",
      description: "D",
      prompt: "P",
    }),
  ).rejects.toThrow("Invalid command name");
});

test("list returns empty array when no commands exist", async () => {
  const commands = await CommandSkills.list(skillsDir);
  expect(commands).toEqual([]);
});

test("list returns empty array when directory does not exist", async () => {
  const commands = await CommandSkills.list(join(skillsDir, "nonexistent"));
  expect(commands).toEqual([]);
});

test("list returns all commands sorted by name", async () => {
  await CommandSkills.create(skillsDir, {
    name: "beta",
    description: "B",
    prompt: "PB",
  });
  await CommandSkills.create(skillsDir, {
    name: "alpha",
    description: "A",
    prompt: "PA",
  });
  const commands = await CommandSkills.list(skillsDir);
  expect(commands).toEqual([
    { name: "alpha", description: "A", prompt: "PA" },
    { name: "beta", description: "B", prompt: "PB" },
  ]);
});

test("list skips directories without command.json", async () => {
  await CommandSkills.create(skillsDir, {
    name: "valid",
    description: "D",
    prompt: "P",
  });
  const { mkdir } = await import("node:fs/promises");
  await mkdir(join(skillsDir, "broken"), { recursive: true });
  const commands = await CommandSkills.list(skillsDir);
  expect(commands).toHaveLength(1);
  expect(commands[0]?.name).toBe("valid");
});

test("delete removes the command directory", async () => {
  await CommandSkills.create(skillsDir, {
    name: "translate",
    description: "D",
    prompt: "P",
  });
  await CommandSkills.delete(skillsDir, "translate");
  const commands = await CommandSkills.list(skillsDir);
  expect(commands).toEqual([]);
});

test("delete throws NotFoundError for missing command", async () => {
  await expect(CommandSkills.delete(skillsDir, "nonexistent")).rejects.toThrow(
    CommandSkills.NotFoundError,
  );
});

test("create rethrows non-ENOENT filesystem errors", async () => {
  const { mkdir: mkdirFs } = await import("node:fs/promises");
  const dir = join(skillsDir, "broken");
  await mkdirFs(dir, { recursive: true });
  await mkdirFs(join(dir, "command.json"), { recursive: true });

  await expect(
    CommandSkills.create(skillsDir, {
      name: "broken",
      description: "D",
      prompt: "P",
    }),
  ).rejects.toThrow();
});

test("delete rethrows non-ENOENT filesystem errors", async () => {
  const { mkdir: mkdirFs } = await import("node:fs/promises");
  const dir = join(skillsDir, "broken");
  await mkdirFs(dir, { recursive: true });
  await mkdirFs(join(dir, "command.json"), { recursive: true });

  await expect(CommandSkills.delete(skillsDir, "broken")).rejects.toThrow();
  await expect(CommandSkills.delete(skillsDir, "broken")).rejects.not.toThrow(
    CommandSkills.NotFoundError,
  );
});

test("toTelegramCommands converts correctly", () => {
  const commands: CommandSkills.Command[] = [
    { name: "translate", description: "Translate text", prompt: "P" },
    { name: "daily", description: "Daily summary", prompt: "P2" },
  ];
  expect(CommandSkills.toTelegramCommands(commands)).toEqual([
    { command: "translate", description: "Translate text" },
    { command: "daily", description: "Daily summary" },
  ]);
});
