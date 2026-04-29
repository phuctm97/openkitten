import { oc } from "@orpc/contract";
import zod from "zod";

const threadSchema = zod.object({
  id: zod.string(),
  houseId: zod.string(),
  title: zod.string(),
  summary: zod.string().nullable(),
  status: zod.string(),
  assignedCatId: zod.string().nullable(),
  goalId: zod.string().nullable(),
  createdAt: zod.date(),
  updatedAt: zod.date(),
  closedAt: zod.date().nullable(),
});

export const list = oc
  .input(
    zod
      .object({
        status: zod.string().optional(),
        assignedCatId: zod.string().optional(),
        goalId: zod.string().optional(),
      })
      .optional(),
  )
  .output(zod.array(threadSchema));

export const get = oc
  .input(zod.object({ id: zod.string() }))
  .output(threadSchema);

export const create = oc
  .input(
    zod.object({
      title: zod.string().min(1),
      summary: zod.string().nullish(),
      assignedCatId: zod.string().nullish(),
      goalId: zod.string().nullish(),
    }),
  )
  .output(threadSchema);

export const update = oc
  .input(
    zod.object({
      id: zod.string(),
      title: zod.string().min(1).optional(),
      summary: zod.string().nullish(),
      assignedCatId: zod.string().nullish(),
      goalId: zod.string().nullish(),
    }),
  )
  .output(threadSchema);

export const close = oc
  .input(zod.object({ id: zod.string() }))
  .output(threadSchema);

export const reopen = oc
  .input(zod.object({ id: zod.string() }))
  .output(threadSchema);

export const remove = oc
  .input(zod.object({ id: zod.string() }))
  .output(zod.literal(true));
