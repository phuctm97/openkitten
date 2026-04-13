import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const house = pgTable("house", {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  name: text().notNull(),
});
