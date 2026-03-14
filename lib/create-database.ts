import { Database as SQLite } from "bun:sqlite";
import { resolve } from "node:path";
import { consola } from "consola";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import type { Database } from "~/lib/database";
import * as schema from "~/lib/schema";

const migrationsFolder = resolve(import.meta.dirname, "../drizzle");

export function createDatabase(filename: string): Database {
  const sqlite = new SQLite(filename);
  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run("PRAGMA foreign_keys = ON");
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder });
  consola.ready("Database is ready");
  return Object.assign(database, {
    [Symbol.dispose]() {
      sqlite.close();
      consola.debug("Database is closed");
    },
  });
}
