import { oc } from "@orpc/contract";
import zod from "zod";

const catSchema = zod.object({
  id: zod.string(),
  houseId: zod.string(),
  name: zod.string(),
  slug: zod.string(),
  description: zod.string().nullable(),
  avatar: zod.string().nullable(),
  mood: zod.string(),
  isResting: zod.boolean(),
  createdAt: zod.date(),
  updatedAt: zod.date(),
});

export const list = oc.output(zod.array(catSchema));

export const get = oc.input(zod.object({ id: zod.string() })).output(catSchema);

export const create = oc
  .input(
    zod.object({
      name: zod.string().min(1),
      description: zod.string().nullish(),
      avatar: zod.string().nullish(),
      mood: zod.string().optional(),
    }),
  )
  .output(catSchema);

export const update = oc
  .input(
    zod.object({
      id: zod.string(),
      name: zod.string().min(1).optional(),
      description: zod.string().nullish(),
      avatar: zod.string().nullish(),
      mood: zod.string().optional(),
      isResting: zod.boolean().optional(),
    }),
  )
  .output(catSchema);

export const remove = oc
  .input(zod.object({ id: zod.string() }))
  .output(zod.literal(true));
