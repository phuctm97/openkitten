import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

export const session = sqliteTable(
  "session",
  {
    id: text().primaryKey(),
    chatId: integer("chat_id").notNull(),
    threadId: integer("thread_id").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    unique("session_chat_id_thread_id_idx").on(table.chatId, table.threadId),
  ],
);

export const message = sqliteTable(
  "message",
  {
    id: text().primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => session.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("message_session_id_idx").on(table.sessionId)],
);

export const sessionRelations = relations(session, ({ many }) => ({
  messages: many(message),
}));

export const messageRelations = relations(message, ({ one }) => ({
  session: one(session, {
    fields: [message.sessionId],
    references: [session.id],
  }),
}));
