import { Model, SqlClient, SqlSchema } from "@effect/sql";
import { SqliteMigrator } from "@effect/sql-sqlite-bun";
import { Context, Effect, Layer, type Option, Schema } from "effect";
import pkg from "~/package.json" with { type: "json" };

class SessionModel extends Model.Class<SessionModel>(`${pkg.name}/Session`)({
  sessionKey: Schema.String,
  sessionId: Schema.String,
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {}

type SessionRepository = Effect.Effect.Success<
  ReturnType<typeof Model.makeRepository<typeof SessionModel, "sessionKey">>
> & {
  readonly findBySessionId: (
    sessionId: string,
  ) => Effect.Effect<Option.Option<SessionModel>>;
};

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
      const sql = yield* SqlClient.SqlClient;
      const sessionRepository = yield* Model.makeRepository(SessionModel, {
        spanPrefix: "Session",
        tableName: "session",
        idColumn: "sessionKey",
      });
      yield* Effect.logDebug("Database.service is connected");
      return Database.of({
        session: {
          ...sessionRepository,
          findBySessionId: (sessionId: string) =>
            SqlSchema.findOne({
              Request: Schema.String,
              Result: SessionModel,
              execute: (sid) =>
                sql`SELECT * FROM session WHERE session_id = ${sid}`,
            })(sessionId).pipe(Effect.orDie),
        },
      });
    }),
  );
}
