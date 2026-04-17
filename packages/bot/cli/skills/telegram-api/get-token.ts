import { join } from "node:path";

const xdgConfig =
  Bun.env["XDG_CONFIG_HOME"] ?? join(Bun.env["HOME"] ?? "", ".config");
const configPath = join(xdgConfig, "openkitten", "telegram.json");
const file = Bun.file(configPath);

if (!(await file.exists())) {
  process.stderr.write(`Error: ${configPath} not found\n`);
  process.exit(1);
}

const config: { botToken: string } = await file.json();
process.stdout.write(config.botToken);
