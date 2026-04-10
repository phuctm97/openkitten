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
    agent: text(),
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

export const schedule = sqliteTable(
  "schedule",
  {
    id: text().primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => session.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    kind: text().notNull(),
    description: text().notNull(),
    prompt: text().notNull(),
    cron: text().notNull(),
    once: integer({ mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [index("schedule_session_id_idx").on(table.sessionId)],
);

export const sessionRelations = relations(session, ({ many }) => ({
  messages: many(message),
  schedules: many(schedule),
}));

export const messageRelations = relations(message, ({ one }) => ({
  session: one(session, {
    fields: [message.sessionId],
    references: [session.id],
  }),
}));

export const scheduleRelations = relations(schedule, ({ one }) => ({
  session: one(session, {
    fields: [schedule.sessionId],
    references: [session.id],
  }),
}));
