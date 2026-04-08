import { afterEach, expect, test } from "vitest";
import { CommandRegistry } from "~/lib/command-registry";
import { Database } from "~/lib/database";

let database: Database | undefined;

afterEach(() => {
  database?.[Symbol.dispose]();
  database = undefined;
});

function setup() {
  database = Database.create();
  return CommandRegistry.create(database);
}

test("create loads empty registry", () => {
  const registry = setup();
  expect(registry.list()).toEqual([]);
});

test("create loads persisted commands", () => {
  database = Database.create();
  const r1 = CommandRegistry.create(database);
  r1.create({ name: "hello", description: "Say hi", prompt: "Hi!" });
  const r2 = CommandRegistry.create(database);
  expect(r2.list()).toEqual([
    { name: "hello", description: "Say hi", prompt: "Hi!" },
  ]);
});

test("get returns command by name", () => {
  const registry = setup();
  registry.create({ name: "greet", description: "Greet", prompt: "Hello" });
  expect(registry.get("greet")).toEqual({
    name: "greet",
    description: "Greet",
    prompt: "Hello",
  });
});

test("get returns undefined for missing command", () => {
  const registry = setup();
  expect(registry.get("nope")).toBeUndefined();
});

test("create adds command to registry and database", () => {
  const registry = setup();
  const cmd = registry.create({
    name: "translate",
    description: "Translate text",
    prompt: "Translate: {text}",
  });
  expect(cmd).toEqual({
    name: "translate",
    description: "Translate text",
    prompt: "Translate: {text}",
  });
  expect(registry.get("translate")).toEqual(cmd);
});

test("create throws DuplicateError for existing name", () => {
  const registry = setup();
  registry.create({ name: "dup", description: "D", prompt: "P" });
  expect(() =>
    registry.create({ name: "dup", description: "D2", prompt: "P2" }),
  ).toThrow(CommandRegistry.DuplicateError);
});

test("create throws ReservedError for builtin names", () => {
  const registry = setup();
  for (const builtin of CommandRegistry.builtins) {
    expect(() =>
      registry.create({
        name: builtin.command,
        description: "X",
        prompt: "Y",
      }),
    ).toThrow(CommandRegistry.ReservedError);
  }
});

test("update changes description", () => {
  const registry = setup();
  registry.create({ name: "cmd", description: "Old", prompt: "P" });
  const updated = registry.update({ name: "cmd", description: "New" });
  expect(updated.description).toBe("New");
  expect(updated.prompt).toBe("P");
});

test("update changes prompt", () => {
  const registry = setup();
  registry.create({ name: "cmd", description: "D", prompt: "Old" });
  const updated = registry.update({ name: "cmd", prompt: "New" });
  expect(updated.prompt).toBe("New");
  expect(updated.description).toBe("D");
});

test("update persists changes", () => {
  database = Database.create();
  const r1 = CommandRegistry.create(database);
  r1.create({ name: "cmd", description: "D", prompt: "P" });
  r1.update({ name: "cmd", description: "D2", prompt: "P2" });
  const r2 = CommandRegistry.create(database);
  expect(r2.get("cmd")).toEqual({
    name: "cmd",
    description: "D2",
    prompt: "P2",
  });
});

test("update with no changes returns existing command", () => {
  const registry = setup();
  registry.create({ name: "cmd", description: "D", prompt: "P" });
  const updated = registry.update({ name: "cmd" });
  expect(updated).toEqual({ name: "cmd", description: "D", prompt: "P" });
});

test("update changes both description and prompt", () => {
  const registry = setup();
  registry.create({ name: "cmd", description: "D", prompt: "P" });
  const updated = registry.update({
    name: "cmd",
    description: "New D",
    prompt: "New P",
  });
  expect(updated.description).toBe("New D");
  expect(updated.prompt).toBe("New P");
});

test("update throws NotFoundError for missing command", () => {
  const registry = setup();
  expect(() => registry.update({ name: "nope", description: "X" })).toThrow(
    CommandRegistry.NotFoundError,
  );
});

test("delete removes command", () => {
  const registry = setup();
  registry.create({ name: "rm", description: "D", prompt: "P" });
  registry.delete("rm");
  expect(registry.get("rm")).toBeUndefined();
  expect(registry.list()).toEqual([]);
});

test("delete persists removal", () => {
  database = Database.create();
  const r1 = CommandRegistry.create(database);
  r1.create({ name: "rm", description: "D", prompt: "P" });
  r1.delete("rm");
  const r2 = CommandRegistry.create(database);
  expect(r2.list()).toEqual([]);
});

test("delete throws NotFoundError for missing command", () => {
  const registry = setup();
  expect(() => registry.delete("nope")).toThrow(CommandRegistry.NotFoundError);
});

test("toTelegramCommands returns builtins followed by sorted custom", () => {
  const registry = setup();
  registry.create({ name: "zebra", description: "Z", prompt: "Z" });
  registry.create({ name: "alpha", description: "A", prompt: "A" });
  const commands = registry.toTelegramCommands();
  expect(commands).toEqual([
    ...CommandRegistry.builtins,
    { command: "alpha", description: "A" },
    { command: "zebra", description: "Z" },
  ]);
});

test("toTelegramCommands returns only builtins when empty", () => {
  const registry = setup();
  expect(registry.toTelegramCommands()).toEqual(CommandRegistry.builtins);
});

test("builtins contains expected commands", () => {
  const names = CommandRegistry.builtins.map((b) => b.command);
  expect(names).toContain("start");
  expect(names).toContain("abort");
  expect(names).toContain("compact");
  expect(names).toContain("agent");
});
