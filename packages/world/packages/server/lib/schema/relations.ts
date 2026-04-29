import { relations } from "drizzle-orm";
import { workspace } from "./app";
import {
  account,
  house,
  house_invitation,
  house_member,
  passkey,
  user,
} from "./auth";

export const userRelations = relations(user, ({ one, many }) => ({
  accounts: many(account),
  passkeys: many(passkey),
  house_members: many(house_member),
  house_invitations: many(house_invitation),
  workspace: one(workspace, {
    fields: [user.id],
    references: [workspace.userId],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const passkeyRelations = relations(passkey, ({ one }) => ({
  user: one(user, {
    fields: [passkey.userId],
    references: [user.id],
  }),
}));

export const houseRelations = relations(house, ({ one, many }) => ({
  house_members: many(house_member),
  house_invitations: many(house_invitation),
  workspace: one(workspace, {
    fields: [house.id],
    references: [workspace.houseId],
  }),
}));

export const house_memberRelations = relations(house_member, ({ one }) => ({
  house: one(house, {
    fields: [house_member.house_id],
    references: [house.id],
  }),
  user: one(user, {
    fields: [house_member.userId],
    references: [user.id],
  }),
}));

export const house_invitationRelations = relations(
  house_invitation,
  ({ one }) => ({
    house: one(house, {
      fields: [house_invitation.house_id],
      references: [house.id],
    }),
    user: one(user, {
      fields: [house_invitation.inviterId],
      references: [user.id],
    }),
  }),
);

export const workspaceRelations = relations(workspace, ({ one }) => ({
  user: one(user, {
    fields: [workspace.userId],
    references: [user.id],
  }),
  house: one(house, {
    fields: [workspace.houseId],
    references: [house.id],
  }),
}));
