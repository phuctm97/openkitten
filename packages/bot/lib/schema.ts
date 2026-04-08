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

export const scheduledTask = sqliteTable(
  "scheduled_task",
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
    once: integer().notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [index("scheduled_task_session_id_idx").on(table.sessionId)],
);

export const command = sqliteTable("command", {
  name: text().primaryKey(),
  description: text().notNull(),
  prompt: text().notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date()),
});

export const sessionRelations = relations(session, ({ many }) => ({
  messages: many(message),
  scheduledTasks: many(scheduledTask),
}));

export const messageRelations = relations(message, ({ one }) => ({
  session: one(session, {
    fields: [message.sessionId],
    references: [session.id],
  }),
}));

export const scheduledTaskRelations = relations(scheduledTask, ({ one }) => ({
  session: one(session, {
    fields: [scheduledTask.sessionId],
    references: [session.id],
  }),
}));
