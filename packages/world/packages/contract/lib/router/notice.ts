import { oc } from "@orpc/contract";
import zod from "zod";

const noticeSchema = zod.object({
  id: zod.string(),
  houseId: zod.string(),
  kind: zod.string(),
  subject: zod.string(),
  body: zod.string().nullable(),
  threadId: zod.string().nullable(),
  catId: zod.string().nullable(),
  readAt: zod.date().nullable(),
  createdAt: zod.date(),
});

export const list = oc
  .input(
    zod
      .object({
        onlyUnread: zod.boolean().optional(),
      })
      .optional(),
  )
  .output(zod.array(noticeSchema));

export const create = oc
  .input(
    zod.object({
      kind: zod.string().optional(),
      subject: zod.string().min(1),
      body: zod.string().nullish(),
      threadId: zod.string().nullish(),
      catId: zod.string().nullish(),
    }),
  )
  .output(noticeSchema);

export const markRead = oc
  .input(zod.object({ id: zod.string() }))
  .output(noticeSchema);

export const markAllRead = oc.output(zod.literal(true));

export const remove = oc
  .input(zod.object({ id: zod.string() }))
  .output(zod.literal(true));
