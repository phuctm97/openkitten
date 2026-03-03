import { eq } from "drizzle-orm";
import { database } from "~/lib/database";
import { profile } from "~/lib/schema";

export function loadSessionID(): string | null {
	const row = database
		.select({ activeSessionId: profile.activeSessionId })
		.from(profile)
		.where(eq(profile.id, 1))
		.get();
	return row?.activeSessionId ?? null;
}

export function saveSessionID(id: string | null): void {
	database
		.insert(profile)
		.values({ id: 1, activeSessionId: id })
		.onConflictDoUpdate({
			target: profile.id,
			set: { activeSessionId: id, updatedAt: Math.floor(Date.now() / 1000) },
		})
		.run();
}
