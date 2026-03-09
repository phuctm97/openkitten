import { Model, SqlClient, SqlSchema } from "@effect/sql";
import { SqliteMigrator } from "@effect/sql-sqlite-bun";
import { Context, Effect, Layer, type Option, Schema } from "effect";
import pkg from "~/package.json" with { type: "json" };

class SessionModel extends Model.Class<SessionModel>(`${pkg.name}/Session`)({
  id: Schema.String,
  chatId: Schema.Number,
  threadId: Schema.Number,
  dmTopicId: Schema.Number,
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {}

const loader = SqliteMigrator.fromRecord({
  "0001_create_session": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE session (
      id TEXT PRIMARY KEY NOT NULL,
      chat_id INTEGER NOT NULL,
      thread_id INTEGER NOT NULL DEFAULT 0,
      dm_topic_id INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(chat_id, thread_id, dm_topic_id)
    )`;
  }),
});

export class Database extends Context.Tag(`${pkg.name}/Database`)<
  Database,
  { readonly session: Database.SessionRepository }
>() {
  static readonly layer = Layer.effect(
    Database,
    Effect.gen(function* () {
      yield* SqliteMigrator.run({ loader });
      const sql = yield* SqlClient.SqlClient;
      const sessionRepository = yield* Model.makeRepository(SessionModel, {
        spanPrefix: "Session",
        tableName: "session",
        idColumn: "id",
      });
      yield* Effect.logDebug("Database.service is connected");
      return Database.of({
        session: {
          ...sessionRepository,
          findByChat: ({ chatId, threadId, dmTopicId }) =>
            SqlSchema.findOne({
              Request: Schema.String,
              Result: SessionModel,
              execute: () =>
                sql`SELECT * FROM session WHERE chat_id = ${chatId} AND thread_id = ${threadId} AND dm_topic_id = ${dmTopicId}`,
            })(`${chatId}:${threadId}:${dmTopicId}`).pipe(Effect.orDie),
        },
      });
    }),
  );
}

export namespace Database {
  export type SessionRepository = Effect.Effect.Success<
    ReturnType<typeof Model.makeRepository<typeof SessionModel, "id">>
  > & {
    readonly findByChat: (
      options: SessionFindByChatOptions,
    ) => Effect.Effect<Option.Option<SessionModel>>;
  };

  export interface SessionFindByChatOptions {
    readonly chatId: number;
    readonly threadId: number;
    readonly dmTopicId: number;
  }
}
