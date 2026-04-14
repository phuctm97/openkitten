import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { pgURL } from "~/lib/pg-url";
import * as schema from "~/lib/schema";

export const pgDatabase = drizzle(pgURL, { schema });

await migrate(pgDatabase, {
  migrationsFolder: resolve(import.meta.dirname, "../drizzle"),
});
