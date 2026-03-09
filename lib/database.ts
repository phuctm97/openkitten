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

class MessageModel extends Model.Class<MessageModel>(`${pkg.name}/Message`)({
  id: Schema.String,
  sessionId: Schema.String,
  createdAt: Schema.Number,
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
  "0002_create_message": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE message (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL REFERENCES session(id),
      created_at INTEGER NOT NULL
    )`;
  }),
});

export class Database extends Context.Tag(`${pkg.name}/Database`)<
  Database,
  {
    readonly session: Database.SessionRepository;
    readonly message: Database.MessageRepository;
  }
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
      const messageRepository = yield* Model.makeRepository(MessageModel, {
        spanPrefix: "Message",
        tableName: "message",
        idColumn: "id",
      });
      yield* Effect.logDebug("Database.service is connected");
      return Database.of({
        session: {
          ...sessionRepository,
          findAll: () =>
            SqlSchema.findAll({
              Request: Schema.Undefined,
              Result: SessionModel,
              execute: () => sql`SELECT * FROM session`,
            })(undefined).pipe(Effect.orDie),
          findByChat: ({ chatId, threadId, dmTopicId }) =>
            SqlSchema.findOne({
              Request: Schema.String,
              Result: SessionModel,
              execute: () =>
                sql`SELECT * FROM session WHERE chat_id = ${chatId} AND thread_id = ${threadId} AND dm_topic_id = ${dmTopicId}`,
            })(`${chatId}:${threadId}:${dmTopicId}`).pipe(Effect.orDie),
        },
        message: {
          ...messageRepository,
          claim: ({ id, sessionId, createdAt }) =>
            sql`INSERT INTO message (id, session_id, created_at) VALUES (${id}, ${sessionId}, ${createdAt}) ON CONFLICT(id) DO NOTHING RETURNING id`.pipe(
              Effect.map((rows) => rows.length > 0),
              Effect.orDie,
            ),
        },
      });
    }),
  );
}

export namespace Database {
  export type Session = SessionModel;

  export interface SessionFindByChatOptions {
    readonly chatId: number;
    readonly threadId: number;
    readonly dmTopicId: number;
  }

  export type SessionRepository = Effect.Effect.Success<
    ReturnType<typeof Model.makeRepository<typeof SessionModel, "id">>
  > & {
    /** Returns all tracked sessions. */
    readonly findAll: () => Effect.Effect<ReadonlyArray<SessionModel>>;
    /** Finds a session by its chat, thread, and DM topic IDs. */
    readonly findByChat: (
      options: SessionFindByChatOptions,
    ) => Effect.Effect<Option.Option<SessionModel>>;
  };

  export type Message = MessageModel;

  export interface MessageClaimOptions {
    readonly id: string;
    readonly sessionId: string;
    readonly createdAt: number;
  }

  export type MessageRepository = Effect.Effect.Success<
    ReturnType<typeof Model.makeRepository<typeof MessageModel, "id">>
  > & {
    /** Attempts to claim a message ID. Returns true if inserted, false if already exists. */
    readonly claim: (options: MessageClaimOptions) => Effect.Effect<boolean>;
  };
}
