import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { migrationsFolder } from "./migrations-folder";
import * as schema from "./schema";

export const database = drizzle(new Database("openkitten.db"), {
	schema,
});

migrate(database, { migrationsFolder });
