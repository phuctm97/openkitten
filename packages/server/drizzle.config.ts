import { defineConfig } from "drizzle-kit";
import { pgURL } from "./lib/pg-url";

export default defineConfig({
  schema: "lib/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: { url: pgURL },
});
