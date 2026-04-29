import { serverPort } from "@openkitten/world-util";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "~/lib/auth";
import { pgDatabase } from "~/lib/pg-database";
import { rpcHandler } from "~/lib/rpc-handler";

const hono = new Hono();

hono.use(
  cors({
    credentials: true,
    origin: auth.options.trustedOrigins,
    exposeHeaders: ["content-type", "content-length", "cache-control"],
    allowHeaders: [
      "content-type",
      "content-length",
      "user-agent",
      "x-active-organization-id",
    ],
    allowMethods: ["GET", "POST"],
    maxAge: 600,
  }),
);

hono.get("/health", async (context) => {
  await pgDatabase.execute(sql`select 1`);
  return context.text("OK");
});

hono.on(["GET", "POST"], `${auth.options.basePath}/*`, (context) =>
  auth.handler(context.req.raw),
);

hono.on(["GET", "POST"], "/rpc/*", async (context) => {
  const { matched, response } = await rpcHandler.handle(context.req.raw, {
    prefix: "/rpc",
    context: { headers: context.req.raw.headers },
  });
  if (matched) return response;
  return context.notFound();
});

export default {
  port: serverPort,
  fetch: hono.fetch,
};
