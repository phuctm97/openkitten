import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
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
