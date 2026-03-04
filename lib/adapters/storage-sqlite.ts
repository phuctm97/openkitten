/** StoragePort adapter backed by Drizzle + bun:sqlite. */

import { Database } from "bun:sqlite";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import type { StoragePort } from "~/lib/ports/storage";
import * as schema from "~/lib/schema";

export class SqliteStorageAdapter implements StoragePort {
	private db: ReturnType<typeof drizzle>;
	private cachedSessionID: string | null | undefined = undefined;

	constructor(dbPath = "openkitten.db", migrationsFolder?: string) {
		this.db = drizzle(new Database(dbPath), { schema });
		migrate(this.db, {
			migrationsFolder:
				migrationsFolder ?? resolve(import.meta.dir, "../../drizzle"),
		});
	}

	getSessionID(): string | null {
		if (this.cachedSessionID === undefined) {
			const row = this.db
				.select({ activeSessionId: schema.profile.activeSessionId })
				.from(schema.profile)
				.where(eq(schema.profile.id, 1))
				.get();
			this.cachedSessionID = row?.activeSessionId ?? null;
		}
		return this.cachedSessionID;
	}

	setSessionID(id: string): void {
		this.db
			.insert(schema.profile)
			.values({ id: 1, activeSessionId: id })
			.onConflictDoUpdate({
				target: schema.profile.id,
				set: {
					activeSessionId: id,
					updatedAt: Math.floor(Date.now() / 1000),
				},
			})
			.run();
		this.cachedSessionID = id;
	}
}
