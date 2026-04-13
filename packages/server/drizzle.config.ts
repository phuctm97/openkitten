import { defineConfig } from "drizzle-kit";
import { pgURL } from "./lib/pg-url";

export default defineConfig({
  schema: "lib/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: pgURL },
});
