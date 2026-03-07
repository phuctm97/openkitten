import { SqliteClient } from "@effect/sql-sqlite-bun";
import { camelCase, snakeCase } from "change-case";
import { Layer } from "effect";
import { Database } from "~/lib/database";

export function makeDatabaseLayer(database = ":memory:") {
  const sqlLayer = SqliteClient.layer({
    filename: database,
    transformResultNames: camelCase,
    transformQueryNames: snakeCase,
  });
  return Database.layer.pipe(Layer.provide(sqlLayer));
}
