import { Hono } from "hono";

const hono = new Hono();

hono.get("/", (context) => context.text("hello world"));

export default {
  fetch: hono.fetch,
};
