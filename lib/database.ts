import { Model, SqlClient } from "@effect/sql";
import { SqliteMigrator } from "@effect/sql-sqlite-bun";
import { Context, Effect, Layer, Schema } from "effect";
import pkg from "~/package.json" with { type: "json" };

class ProfileModel extends Model.Class<ProfileModel>(`${pkg.name}/Profile`)({
  id: Schema.String,
  activeSessionId: Model.FieldOption(Schema.String),
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {}

type ProfileRepository = Effect.Effect.Success<
  ReturnType<typeof Model.makeRepository<typeof ProfileModel, "id">>
>;

const loader = SqliteMigrator.fromRecord({
  "0001_create_profile": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE profile (
      id TEXT PRIMARY KEY NOT NULL,
      active_session_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`;
  }),
});

export class Database extends Context.Tag(`${pkg.name}/Database`)<
  Database,
  { readonly profile: ProfileRepository }
>() {
  static readonly layer = Layer.effect(
    Database,
    Effect.gen(function* () {
      yield* SqliteMigrator.run({ loader });
      const profile = yield* Model.makeRepository(ProfileModel, {
        spanPrefix: "Profile",
        tableName: "profile",
        idColumn: "id",
      });
      yield* Effect.logInfo("Database connection is established");
      return { profile };
    }),
  );
}
