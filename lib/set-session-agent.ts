import { eq } from "drizzle-orm";
import type { Database } from "~/lib/database";
import * as schema from "~/lib/schema";

export function setSessionAgent(
  database: Database,
  sessionId: string,
  agent: string | null,
): void {
  database
    .update(schema.session)
    .set({ agent })
    .where(eq(schema.session.id, sessionId))
    .run();
}
