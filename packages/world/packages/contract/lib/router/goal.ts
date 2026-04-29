import { oc } from "@orpc/contract";
import zod from "zod";

const goalSchema = zod.object({
  id: zod.string(),
  houseId: zod.string(),
  title: zod.string(),
  description: zod.string().nullable(),
  status: zod.string(),
  createdAt: zod.date(),
  updatedAt: zod.date(),
  achievedAt: zod.date().nullable(),
});

export const list = oc.output(zod.array(goalSchema));

export const get = oc
  .input(zod.object({ id: zod.string() }))
  .output(goalSchema);

export const create = oc
  .input(
    zod.object({
      title: zod.string().min(1),
      description: zod.string().nullish(),
      status: zod.string().optional(),
    }),
  )
  .output(goalSchema);

export const update = oc
  .input(
    zod.object({
      id: zod.string(),
      title: zod.string().min(1).optional(),
      description: zod.string().nullish(),
      status: zod.string().optional(),
      achievedAt: zod.date().nullish(),
    }),
  )
  .output(goalSchema);

export const remove = oc
  .input(zod.object({ id: zod.string() }))
  .output(zod.literal(true));
