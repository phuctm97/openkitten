// @ts-nocheck — Bun-specific `{ type: "file" }` imports are not understood by TypeScript.
import { dirname } from "node:path";
import journal from "../drizzle/meta/_journal.json" with { type: "file" };

export const migrationsFolder: string = dirname(dirname(journal));
