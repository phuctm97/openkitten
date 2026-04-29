import zod from "zod";

const workspaceMemberSchema = zod.object({
  id: zod.string(),
  userId: zod.string(),
  role: zod.string(),
  createdAt: zod.date(),
  user: zod.object({
    id: zod.string(),
    name: zod.string(),
    email: zod.string(),
    image: zod.string().nullish(),
  }),
});

const workspaceInvitationSchema = zod.object({
  id: zod.string(),
  email: zod.string(),
  role: zod.string().nullable(),
  status: zod.string(),
  expiresAt: zod.date(),
});

export const workspaceSchema = zod.object({
  workspace: zod.object({
    id: zod.number(),
    userId: zod.string().nullable(),
    houseId: zod.string(),
    isPersonal: zod.boolean(),
    createdAt: zod.date(),
    updatedAt: zod.date(),
  }),
  house: zod.object({
    id: zod.string(),
    name: zod.string(),
    slug: zod.string(),
    logo: zod.string().nullable(),
    metadata: zod.string().nullable(),
    createdAt: zod.date(),
  }),
  members: zod.array(workspaceMemberSchema),
  invitations: zod.array(workspaceInvitationSchema),
  activeMember: zod.object({
    id: zod.string(),
    role: zod.string(),
    createdAt: zod.date(),
  }),
});
