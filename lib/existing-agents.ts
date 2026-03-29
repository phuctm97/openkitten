import { eq } from "drizzle-orm";
import type { Database } from "~/lib/database";
import * as schema from "~/lib/schema";

export class ExistingAgents {
  readonly #database: Database;

  private constructor(database: Database) {
    this.#database = database;
  }

  get(sessionId: string): string | undefined {
    const row = this.#database.query.session
      .findFirst({
        columns: { agent: true },
        where: eq(schema.session.id, sessionId),
      })
      .sync();
    return row?.agent || undefined;
  }

  set(sessionId: string, agent: string | null): void {
    this.#database
      .update(schema.session)
      .set({ agent })
      .where(eq(schema.session.id, sessionId))
      .run();
  }

  static create(database: Database): ExistingAgents {
    return new ExistingAgents(database);
  }
}
