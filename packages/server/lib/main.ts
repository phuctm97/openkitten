import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { pgDatabase } from "~/lib/pg-database";

const hono = new Hono();

hono.get("/v1/health", async (context) => {
  await pgDatabase.execute(sql`select 1`);
  return context.text("OK");
});

export default {
  fetch: hono.fetch,
};
