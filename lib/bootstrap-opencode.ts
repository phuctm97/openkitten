import { constants } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Errors } from "~/lib/errors";

const defaultOpencodeConfig = {
  $schema: "https://opencode.ai/config.json",
  default_agent: "assist",
};

const srcAgentsDir = resolve(import.meta.dirname, "../agents");

export async function bootstrapOpencode(configDir: string): Promise<void> {
  const dstAgentsDir = join(configDir, "agents");
  await mkdir(dstAgentsDir, { recursive: true });
  const glob = new Bun.Glob("*.md");
  const writes = [];
  for await (const file of glob.scan(srcAgentsDir)) {
    writes.push(
      copyFile(
        join(srcAgentsDir, file),
        join(dstAgentsDir, file),
        constants.COPYFILE_EXCL,
      ),
    );
  }
  writes.push(
    writeFile(
      join(configDir, "opencode.json"),
      JSON.stringify(defaultOpencodeConfig, null, 2),
      { flag: "wx" },
    ),
  );
  const results = await Promise.allSettled(writes);
  const errors = results
    .filter(
      (r): r is PromiseRejectedResult =>
        r.status === "rejected" && r.reason?.code !== "EEXIST",
    )
    .map((r) => r.reason);
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new Errors(...errors);
}
