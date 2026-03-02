import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const profile = sqliteTable("profile", {
	id: integer("id")
		.primaryKey()
		.$defaultFn(() => 1),
	activeSessionId: text("active_session_id"),
	createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
	updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
});
