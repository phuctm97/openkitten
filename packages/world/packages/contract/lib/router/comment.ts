import { oc } from "@orpc/contract";
import zod from "zod";

const commentSchema = zod.object({
  id: zod.string(),
  threadId: zod.string(),
  authorUserId: zod.string().nullable(),
  authorCatId: zod.string().nullable(),
  body: zod.string(),
  createdAt: zod.date(),
});

export const listByThread = oc
  .input(zod.object({ threadId: zod.string() }))
  .output(zod.array(commentSchema));

export const create = oc
  .input(
    zod.object({
      threadId: zod.string(),
      body: zod.string().min(1),
    }),
  )
  .output(commentSchema);

export const remove = oc
  .input(zod.object({ id: zod.string() }))
  .output(zod.literal(true));
