import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
} from "drizzle-orm/relations";
import { expect, it } from "vitest";

import {
  account,
  accountRelations,
  house,
  passkey,
  passkeyRelations,
  session,
  sessionRelations,
  user,
  userRelations,
  verification,
} from "~/lib/schema";

it("defines the expected postgres table", () => {
  const columns = getTableColumns(house);

  expect(getTableName(house)).toBe("house");
  expect(Object.keys(columns)).toStrictEqual(["id", "name"]);
  expect(columns.id.primary).toBe(true);
  expect(columns.id.hasDefault).toBe(true);
  expect(columns.id.notNull).toBe(true);
  expect(columns.name.primary).toBe(false);
  expect(columns.name.notNull).toBe(true);
});

it("defines the Better Auth postgres tables", () => {
  const userColumns = getTableColumns(user);
  const sessionColumns = getTableColumns(session);
  const accountColumns = getTableColumns(account);
  const verificationColumns = getTableColumns(verification);
  const passkeyColumns = getTableColumns(passkey);
  const sessionConfig = getTableConfig(session);
  const accountConfig = getTableConfig(account);
  const verificationConfig = getTableConfig(verification);
  const passkeyConfig = getTableConfig(passkey);
  const relationalConfig = extractTablesRelationalConfig(
    {
      user,
      session,
      account,
      passkey,
      userRelations,
      sessionRelations,
      accountRelations,
      passkeyRelations,
    },
    createTableRelationsHelpers,
  );

  expect(getTableName(user)).toBe("user");
  expect(Object.keys(userColumns)).toStrictEqual([
    "id",
    "name",
    "email",
    "emailVerified",
    "image",
    "createdAt",
    "updatedAt",
  ]);
  expect(getTableName(session)).toBe("session");
  expect(Object.keys(sessionColumns)).toStrictEqual([
    "id",
    "expiresAt",
    "token",
    "createdAt",
    "updatedAt",
    "ipAddress",
    "userAgent",
    "userId",
  ]);
  expect(getTableName(account)).toBe("account");
  expect(Object.keys(accountColumns)).toStrictEqual([
    "id",
    "accountId",
    "providerId",
    "userId",
    "accessToken",
    "refreshToken",
    "idToken",
    "accessTokenExpiresAt",
    "refreshTokenExpiresAt",
    "scope",
    "password",
    "createdAt",
    "updatedAt",
  ]);
  expect(getTableName(verification)).toBe("verification");
  expect(Object.keys(verificationColumns)).toStrictEqual([
    "id",
    "identifier",
    "value",
    "expiresAt",
    "createdAt",
    "updatedAt",
  ]);
  expect(userColumns.updatedAt.onUpdateFn?.()).toBeInstanceOf(Date);
  expect(sessionColumns.updatedAt.onUpdateFn?.()).toBeInstanceOf(Date);
  expect(accountColumns.updatedAt.onUpdateFn?.()).toBeInstanceOf(Date);
  expect(verificationColumns.updatedAt.onUpdateFn?.()).toBeInstanceOf(Date);
  expect(sessionConfig.indexes).toHaveLength(1);
  expect(sessionConfig.foreignKeys).toHaveLength(1);
  expect(sessionConfig.foreignKeys[0]?.reference()).toBeDefined();
  expect(accountConfig.indexes).toHaveLength(1);
  expect(accountConfig.foreignKeys).toHaveLength(1);
  expect(accountConfig.foreignKeys[0]?.reference()).toBeDefined();
  expect(verificationConfig.indexes).toHaveLength(1);
  expect(getTableName(passkey)).toBe("passkey");
  expect(Object.keys(passkeyColumns)).toStrictEqual([
    "id",
    "name",
    "publicKey",
    "userId",
    "credentialID",
    "counter",
    "deviceType",
    "backedUp",
    "transports",
    "createdAt",
    "aaguid",
  ]);
  expect(passkeyConfig.indexes).toHaveLength(2);
  expect(passkeyConfig.foreignKeys).toHaveLength(1);
  expect(passkeyConfig.foreignKeys[0]?.reference()).toBeDefined();
  expect(Object.keys(relationalConfig.tables)).toStrictEqual([
    "user",
    "session",
    "account",
    "passkey",
  ]);
  expect(userRelations).toBeDefined();
  expect(sessionRelations).toBeDefined();
  expect(accountRelations).toBeDefined();
  expect(passkeyRelations).toBeDefined();
});
