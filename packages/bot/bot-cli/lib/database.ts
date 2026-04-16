import { Database as SQLite } from "bun:sqlite";
import { join, resolve } from "node:path";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import type { Profile } from "~/lib/profile";
import * as schema from "~/lib/schema";

export type Database = BunSQLiteDatabase<typeof schema> & Disposable;

export namespace Database {
  export const migrationsFolder = resolve(import.meta.dirname, "../drizzle");

  export function create(profile?: Profile): Database {
    const filename = profile
      ? join(profile.xdgData, "openkitten", "openkitten.db")
      : undefined;
    const sqlite = new SQLite(filename);
    try {
      sqlite.run("PRAGMA journal_mode = WAL");
      sqlite.run("PRAGMA foreign_keys = ON");
      const database = drizzle(sqlite, { schema });
      migrate(database, { migrationsFolder: Database.migrationsFolder });
      return Object.assign(database, {
        [Symbol.dispose]() {
          sqlite.close();
        },
      });
    } catch (error) {
      sqlite.close();
      throw error;
    }
  }
}
