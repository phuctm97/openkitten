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
    chatId: integer("chat_id").notNull(),
    threadId: integer("thread_id").notNull().default(0),
    description: text().notNull(),
    prompt: text().notNull(),
    cron: text().notNull(),
    timezone: text().notNull().default("UTC"),
    once: integer({ mode: "boolean" }).notNull().default(false),
    enabled: integer({ mode: "boolean" }).notNull().default(true),
    overlap: text().notNull().default("queue"),
    notifyOnFailure: integer("notify_on_failure", { mode: "boolean" })
      .notNull()
      .default(false),
    maxRuntimeMs: integer("max_runtime_ms"),
    sessionId: text("session_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("schedule_chat_id_thread_id_idx").on(table.chatId, table.threadId),
  ],
);

export const scheduleRun = sqliteTable(
  "schedule_run",
  {
    id: text().primaryKey(),
    scheduleId: text("schedule_id")
      .notNull()
      .references(() => schedule.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    runSessionId: text("run_session_id"),
    queueJobId: text("queue_job_id"),
    trigger: text().notNull(),
    status: text().notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
    output: text(),
    error: text(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("schedule_run_schedule_id_idx").on(table.scheduleId),
    index("schedule_run_status_started_at_idx").on(
      table.status,
      table.startedAt,
    ),
  ],
);

export const restartNotification = sqliteTable("restart_notification", {
  id: integer().primaryKey({ autoIncrement: true }),
  chatId: integer("chat_id").notNull(),
  threadId: integer("thread_id").notNull().default(0),
  message: text().notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const sessionRelations = relations(session, ({ many }) => ({
  messages: many(message),
}));

export const messageRelations = relations(message, ({ one }) => ({
  session: one(session, {
    fields: [message.sessionId],
    references: [session.id],
  }),
}));

export const scheduleRelations = relations(schedule, ({ many }) => ({
  runs: many(scheduleRun),
}));

export const scheduleRunRelations = relations(scheduleRun, ({ one }) => ({
  schedule: one(schedule, {
    fields: [scheduleRun.scheduleId],
    references: [schedule.id],
  }),
}));
