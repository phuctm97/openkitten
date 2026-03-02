import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "lib/schema.ts",
	dialect: "sqlite",
	dbCredentials: {
		url: "openkitten.db",
	},
});
