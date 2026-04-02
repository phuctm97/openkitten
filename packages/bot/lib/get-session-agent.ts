import { eq } from "drizzle-orm";
import type { Database } from "~/lib/database";
import * as schema from "~/lib/schema";

export function getSessionAgent(
  database: Database,
  sessionId: string,
): string | undefined {
  const row = database.query.session
    .findFirst({
      columns: { agent: true },
      where: eq(schema.session.id, sessionId),
    })
    .sync();
  return row?.agent || undefined;
}
