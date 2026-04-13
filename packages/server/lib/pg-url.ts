export const pgURL =
  Bun.env["PG_URL"] || "postgres://postgres:postgres@localhost:5432/postgres";
