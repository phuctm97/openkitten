import { Database as SQLite } from "bun:sqlite";
import { resolve } from "node:path";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { logger } from "~/lib/logger";
import * as schema from "~/lib/schema";

export type Database = BunSQLiteDatabase<typeof schema> & Disposable;

export namespace Database {
  export const migrationsFolder = resolve(import.meta.dirname, "../drizzle");

  export function create(filename?: string): Database {
    logger.debug("Database is initializing…");
    const sqlite = new SQLite(filename);
    try {
      sqlite.run("PRAGMA journal_mode = WAL");
      sqlite.run("PRAGMA foreign_keys = ON");
      const database = drizzle(sqlite, { schema });
      migrate(database, { migrationsFolder: Database.migrationsFolder });
      logger.info("Database is ready");
      return Object.assign(database, {
        [Symbol.dispose]() {
          sqlite.close();
          logger.info("Database is closed");
        },
      });
    } catch (error) {
      sqlite.close();
      throw error;
    }
  }
}
