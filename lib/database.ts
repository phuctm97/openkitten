import { Database } from "bun:sqlite";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { FS_DATABASE_PATH } from "~/lib/constants/fs";
import * as schema from "./schema";

export const database = drizzle(new Database(FS_DATABASE_PATH), {
	schema,
});

migrate(database, { migrationsFolder: resolve(import.meta.dir, "../drizzle") });
