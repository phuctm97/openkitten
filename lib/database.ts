import { Model, SqlClient } from "@effect/sql";
import { SqliteMigrator } from "@effect/sql-sqlite-bun";
import { Context, Effect, Layer, Schema } from "effect";
import pkg from "~/package.json" with { type: "json" };

class SessionModel extends Model.Class<SessionModel>(`${pkg.name}/Session`)({
  sessionKey: Schema.String,
  sessionId: Schema.String,
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {}

type SessionRepository = Effect.Effect.Success<
  ReturnType<typeof Model.makeRepository<typeof SessionModel, "sessionKey">>
>;

const loader = SqliteMigrator.fromRecord({
  "0001_create_session": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE session (
      session_key TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`;
  }),
});

export class Database extends Context.Tag(`${pkg.name}/Database`)<
  Database,
  { readonly session: SessionRepository }
>() {
  static readonly layer = Layer.effect(
    Database,
    Effect.gen(function* () {
      yield* SqliteMigrator.run({ loader });
      const session = yield* Model.makeRepository(SessionModel, {
        spanPrefix: "Session",
        tableName: "session",
        idColumn: "sessionKey",
      });
      yield* Effect.logDebug("Database.service is connected");
      return { session };
    }),
  );
}
