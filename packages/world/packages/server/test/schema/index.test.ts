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
  house_invitation,
  house_invitationRelations,
  house_member,
  house_memberRelations,
  houseRelations,
  passkey,
  passkeyRelations,
  user,
  userRelations,
  verification,
  workspace,
  workspaceRelations,
} from "~/lib/schema";

it("defines the Better Auth postgres tables", () => {
  const userColumns = getTableColumns(user);
  const accountColumns = getTableColumns(account);
  const verificationColumns = getTableColumns(verification);
  const passkeyColumns = getTableColumns(passkey);
  const accountConfig = getTableConfig(account);
  const verificationConfig = getTableConfig(verification);
  const passkeyConfig = getTableConfig(passkey);

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
  expect(accountColumns.updatedAt.onUpdateFn?.()).toBeInstanceOf(Date);
  expect(verificationColumns.updatedAt.onUpdateFn?.()).toBeInstanceOf(Date);
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
});

it("defines the house postgres tables", () => {
  const houseColumns = getTableColumns(house);
  const memberColumns = getTableColumns(house_member);
  const invitationColumns = getTableColumns(house_invitation);
  const houseConfig = getTableConfig(house);
  const memberConfig = getTableConfig(house_member);
  const invitationConfig = getTableConfig(house_invitation);

  expect(getTableName(house)).toBe("house");
  expect(Object.keys(houseColumns)).toStrictEqual([
    "id",
    "name",
    "slug",
    "logo",
    "createdAt",
    "metadata",
  ]);
  expect(houseConfig.indexes).toHaveLength(1);

  expect(getTableName(house_member)).toBe("house_member");
  expect(Object.keys(memberColumns)).toStrictEqual([
    "id",
    "house_id",
    "userId",
    "role",
    "createdAt",
  ]);
  expect(memberConfig.indexes).toHaveLength(2);
  expect(memberConfig.foreignKeys).toHaveLength(2);
  expect(memberConfig.foreignKeys[0]?.reference()).toBeDefined();
  expect(memberConfig.foreignKeys[1]?.reference()).toBeDefined();

  expect(getTableName(house_invitation)).toBe("house_invitation");
  expect(Object.keys(invitationColumns)).toStrictEqual([
    "id",
    "house_id",
    "email",
    "role",
    "status",
    "expiresAt",
    "createdAt",
    "inviterId",
  ]);
  expect(invitationConfig.indexes).toHaveLength(2);
  expect(invitationConfig.foreignKeys).toHaveLength(2);
  expect(invitationConfig.foreignKeys[0]?.reference()).toBeDefined();
  expect(invitationConfig.foreignKeys[1]?.reference()).toBeDefined();
});

it("defines the workspace postgres table", () => {
  const workspaceColumns = getTableColumns(workspace);
  const workspaceConfig = getTableConfig(workspace);

  expect(getTableName(workspace)).toBe("workspace");
  expect(Object.keys(workspaceColumns)).toStrictEqual([
    "id",
    "userId",
    "houseId",
    "createdAt",
    "updatedAt",
  ]);
  expect(workspaceConfig.foreignKeys).toHaveLength(2);
  expect(workspaceConfig.foreignKeys[0]?.reference()).toBeDefined();
  expect(workspaceConfig.foreignKeys[1]?.reference()).toBeDefined();
  expect(workspaceColumns.updatedAt.onUpdateFn?.()).toBeInstanceOf(Date);
});

it("registers all relational tables", () => {
  const relationalConfig = extractTablesRelationalConfig(
    {
      user,
      account,
      passkey,
      house,
      house_member,
      house_invitation,
      workspace,
      userRelations,
      accountRelations,
      passkeyRelations,
      houseRelations,
      house_memberRelations,
      house_invitationRelations,
      workspaceRelations,
    },
    createTableRelationsHelpers,
  );

  expect(Object.keys(relationalConfig.tables)).toStrictEqual([
    "user",
    "account",
    "passkey",
    "house",
    "house_member",
    "house_invitation",
    "workspace",
  ]);
  expect(userRelations).toBeDefined();
  expect(accountRelations).toBeDefined();
  expect(passkeyRelations).toBeDefined();
  expect(houseRelations).toBeDefined();
  expect(house_memberRelations).toBeDefined();
  expect(house_invitationRelations).toBeDefined();
  expect(workspaceRelations).toBeDefined();
});
