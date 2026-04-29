import { relations } from "drizzle-orm";
import {
  cat,
  comment,
  goal,
  memo,
  notice,
  rule,
  thread,
  workspace,
} from "./app";
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
  comments: many(comment),
  memos: many(memo),
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
  cats: many(cat),
  goals: many(goal),
  threads: many(thread),
  notices: many(notice),
  memos: many(memo),
  rules: many(rule),
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

export const catRelations = relations(cat, ({ one, many }) => ({
  house: one(house, {
    fields: [cat.houseId],
    references: [house.id],
  }),
  threads: many(thread),
  comments: many(comment),
  memos: many(memo),
  notices: many(notice),
}));

export const goalRelations = relations(goal, ({ one, many }) => ({
  house: one(house, {
    fields: [goal.houseId],
    references: [house.id],
  }),
  threads: many(thread),
}));

export const threadRelations = relations(thread, ({ one, many }) => ({
  house: one(house, {
    fields: [thread.houseId],
    references: [house.id],
  }),
  assignedCat: one(cat, {
    fields: [thread.assignedCatId],
    references: [cat.id],
  }),
  goal: one(goal, {
    fields: [thread.goalId],
    references: [goal.id],
  }),
  comments: many(comment),
  notices: many(notice),
}));

export const commentRelations = relations(comment, ({ one }) => ({
  thread: one(thread, {
    fields: [comment.threadId],
    references: [thread.id],
  }),
  authorUser: one(user, {
    fields: [comment.authorUserId],
    references: [user.id],
  }),
  authorCat: one(cat, {
    fields: [comment.authorCatId],
    references: [cat.id],
  }),
}));

export const noticeRelations = relations(notice, ({ one }) => ({
  house: one(house, {
    fields: [notice.houseId],
    references: [house.id],
  }),
  thread: one(thread, {
    fields: [notice.threadId],
    references: [thread.id],
  }),
  cat: one(cat, {
    fields: [notice.catId],
    references: [cat.id],
  }),
}));

export const memoRelations = relations(memo, ({ one }) => ({
  house: one(house, {
    fields: [memo.houseId],
    references: [house.id],
  }),
  authorUser: one(user, {
    fields: [memo.authorUserId],
    references: [user.id],
  }),
  targetCat: one(cat, {
    fields: [memo.targetCatId],
    references: [cat.id],
  }),
}));

export const ruleRelations = relations(rule, ({ one }) => ({
  house: one(house, {
    fields: [rule.houseId],
    references: [house.id],
  }),
}));
