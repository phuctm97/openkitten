import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { database } from "~/lib/database";

const hono = new Hono();

hono.get("/v1/health", async (context) => {
  await database.execute(sql`select 1`);
  return context.text("OK");
});

export default {
  fetch: hono.fetch,
};
