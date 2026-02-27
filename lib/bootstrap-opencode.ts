import { constants } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const agentsDir = resolve(import.meta.dirname, "../agents");

const opencodeConfig = JSON.stringify({
  $schema: "https://opencode.ai/config.json",
  default_agent: "assist",
});

export async function bootstrapOpencode(configDir: string): Promise<void> {
  const targetDir = join(configDir, "agents");
  await mkdir(targetDir, { recursive: true });
  const glob = new Bun.Glob("*.md");
  const copies = [];
  for await (const file of glob.scan(agentsDir)) {
    copies.push(
      copyFile(
        join(agentsDir, file),
        join(targetDir, file),
        constants.COPYFILE_EXCL,
      ),
    );
  }
  copies.push(
    writeFile(join(configDir, "opencode.json"), opencodeConfig, {
      flag: "wx",
    }),
  );
  const results = await Promise.allSettled(copies);
  for (const result of results) {
    if (result.status === "rejected" && result.reason?.code !== "EEXIST") {
      throw result.reason;
    }
  }
}
