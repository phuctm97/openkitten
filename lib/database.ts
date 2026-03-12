import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "~/lib/schema";

export type Database = BunSQLiteDatabase<typeof schema> & Disposable;
