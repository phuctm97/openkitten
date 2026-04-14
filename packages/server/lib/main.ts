import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "~/lib/auth";
import { pgDatabase } from "~/lib/pg-database";
import { serverPort } from "~/lib/server-port";

const hono = new Hono();

hono.use(
  cors({
    credentials: true,
    origin: auth.options.trustedOrigins,
    exposeHeaders: ["content-type", "content-length", "cache-control"],
    allowHeaders: ["content-type", "content-length", "user-agent"],
    allowMethods: ["GET", "POST"],
    maxAge: 600,
  }),
);

hono.get("/v1/health", async (context) => {
  await pgDatabase.execute(sql`select 1`);
  return context.text("OK");
});

hono.on(["GET", "POST"], `${auth.options.basePath}/*`, (context) =>
  auth.handler(context.req.raw),
);

export default {
  port: serverPort,
  fetch: hono.fetch,
};
