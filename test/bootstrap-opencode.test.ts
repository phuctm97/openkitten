import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { bootstrapOpencode } from "~/lib/bootstrap-opencode";

let configDir: string;

beforeEach(async () => {
  configDir = await mkdtemp(join(tmpdir(), "opencode-"));
});

afterEach(async () => {
  await rm(configDir, { recursive: true });
});

test("copies agent files", async () => {
  await bootstrapOpencode(configDir);
  await expect(
    readFile(join(configDir, "agents", "assist.md"), "utf-8"),
  ).resolves.toBeDefined();
  await expect(
    readFile(join(configDir, "agents", "build.md"), "utf-8"),
  ).resolves.toBeDefined();
  await expect(
    readFile(join(configDir, "agents", "plan.md"), "utf-8"),
  ).resolves.toBeDefined();
});

test("writes opencode config", async () => {
  await bootstrapOpencode(configDir);
  const config = JSON.parse(
    await readFile(join(configDir, "opencode.json"), "utf-8"),
  );
  expect(config.default_agent).toBe("assist");
});

test("does not overwrite existing opencode config", async () => {
  await bootstrapOpencode(configDir);
  const configPath = join(configDir, "opencode.json");
  await writeFile(configPath, JSON.stringify({ default_agent: "build" }));
  await bootstrapOpencode(configDir);
  const config = JSON.parse(await readFile(configPath, "utf-8"));
  expect(config.default_agent).toBe("build");
});

test("does not overwrite existing agent files", async () => {
  await bootstrapOpencode(configDir);
  const buildPath = join(configDir, "agents", "build.md");
  await writeFile(buildPath, "custom content");
  await bootstrapOpencode(configDir);
  const content = await readFile(buildPath, "utf-8");
  expect(content).toBe("custom content");
});

test("copies new agents while preserving existing ones", async () => {
  await bootstrapOpencode(configDir);
  const buildPath = join(configDir, "agents", "build.md");
  await writeFile(buildPath, "custom content");
  await bootstrapOpencode(configDir);
  const buildContent = await readFile(buildPath, "utf-8");
  expect(buildContent).toBe("custom content");
  const planPath = join(configDir, "agents", "plan.md");
  const planContent = await readFile(planPath, "utf-8");
  expect(planContent).not.toBe("custom content");
});

test("throws on non-EEXIST errors", async () => {
  const agentsPath = join(configDir, "agents");
  await mkdir(agentsPath, { recursive: true });
  await chmod(agentsPath, 0o444);
  try {
    await expect(bootstrapOpencode(configDir)).rejects.toThrow();
  } finally {
    await chmod(agentsPath, 0o755);
  }
});
