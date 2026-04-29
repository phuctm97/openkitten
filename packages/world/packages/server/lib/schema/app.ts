import {
  boolean,
  index,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { house, user } from "./auth";

export const workspace = pgTable("workspace", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  houseId: text("house_id")
    .notNull()
    .unique()
    .references(() => house.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const cat = pgTable(
  "cat",
  {
    id: text("id").primaryKey(),
    houseId: text("house_id")
      .notNull()
      .references(() => house.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    avatar: text("avatar"),
    mood: text("mood").default("awake").notNull(),
    isResting: boolean("is_resting").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("cat_house_id_idx").on(table.houseId),
    uniqueIndex("cat_house_id_slug_uidx").on(table.houseId, table.slug),
  ],
);

export const goal = pgTable(
  "goal",
  {
    id: text("id").primaryKey(),
    houseId: text("house_id")
      .notNull()
      .references(() => house.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    achievedAt: timestamp("achieved_at"),
  },
  (table) => [
    index("goal_house_id_idx").on(table.houseId),
    index("goal_house_id_status_idx").on(table.houseId, table.status),
  ],
);

export const thread = pgTable(
  "thread",
  {
    id: text("id").primaryKey(),
    houseId: text("house_id")
      .notNull()
      .references(() => house.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary"),
    status: text("status").default("open").notNull(),
    assignedCatId: text("assigned_cat_id").references(() => cat.id, {
      onDelete: "set null",
    }),
    goalId: text("goal_id").references(() => goal.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    closedAt: timestamp("closed_at"),
  },
  (table) => [
    index("thread_house_id_idx").on(table.houseId),
    index("thread_house_id_status_idx").on(table.houseId, table.status),
    index("thread_assigned_cat_id_idx").on(table.assignedCatId),
    index("thread_goal_id_idx").on(table.goalId),
  ],
);

export const comment = pgTable(
  "comment",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => thread.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    authorCatId: text("author_cat_id").references(() => cat.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("comment_thread_id_idx").on(table.threadId),
    index("comment_thread_id_created_at_idx").on(
      table.threadId,
      table.createdAt,
    ),
  ],
);

export const notice = pgTable(
  "notice",
  {
    id: text("id").primaryKey(),
    houseId: text("house_id")
      .notNull()
      .references(() => house.id, { onDelete: "cascade" }),
    kind: text("kind").default("general").notNull(),
    subject: text("subject").notNull(),
    body: text("body"),
    threadId: text("thread_id").references(() => thread.id, {
      onDelete: "cascade",
    }),
    catId: text("cat_id").references(() => cat.id, {
      onDelete: "cascade",
    }),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notice_house_id_idx").on(table.houseId),
    index("notice_house_id_read_at_idx").on(table.houseId, table.readAt),
    index("notice_thread_id_idx").on(table.threadId),
    index("notice_cat_id_idx").on(table.catId),
  ],
);

export const memo = pgTable(
  "memo",
  {
    id: text("id").primaryKey(),
    houseId: text("house_id")
      .notNull()
      .references(() => house.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    targetCatId: text("target_cat_id").references(() => cat.id, {
      onDelete: "cascade",
    }),
    body: text("body").notNull(),
    pinnedAt: timestamp("pinned_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("memo_house_id_idx").on(table.houseId),
    index("memo_target_cat_id_idx").on(table.targetCatId),
    index("memo_house_id_pinned_at_idx").on(table.houseId, table.pinnedAt),
  ],
);

export const rule = pgTable(
  "rule",
  {
    id: text("id").primaryKey(),
    houseId: text("house_id")
      .notNull()
      .references(() => house.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("rule_house_id_idx").on(table.houseId),
    index("rule_house_id_enabled_idx").on(table.houseId, table.enabled),
  ],
);
