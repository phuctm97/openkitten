import { Hono } from "hono";

const hono = new Hono();

hono.get("/", (context) => context.text("Hello, world!"));

export default {
  fetch: hono.fetch,
};
