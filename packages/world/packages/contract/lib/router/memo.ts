import { oc } from "@orpc/contract";
import zod from "zod";

const memoSchema = zod.object({
  id: zod.string(),
  houseId: zod.string(),
  authorUserId: zod.string().nullable(),
  targetCatId: zod.string().nullable(),
  body: zod.string(),
  pinnedAt: zod.date().nullable(),
  createdAt: zod.date(),
  updatedAt: zod.date(),
});

export const list = oc
  .input(
    zod
      .object({
        targetCatId: zod.string().nullish(),
      })
      .optional(),
  )
  .output(zod.array(memoSchema));

export const get = oc
  .input(zod.object({ id: zod.string() }))
  .output(memoSchema);

export const create = oc
  .input(
    zod.object({
      body: zod.string().min(1),
      targetCatId: zod.string().nullish(),
    }),
  )
  .output(memoSchema);

export const update = oc
  .input(
    zod.object({
      id: zod.string(),
      body: zod.string().min(1).optional(),
      targetCatId: zod.string().nullish(),
    }),
  )
  .output(memoSchema);

export const pin = oc
  .input(zod.object({ id: zod.string() }))
  .output(memoSchema);

export const unpin = oc
  .input(zod.object({ id: zod.string() }))
  .output(memoSchema);

export const remove = oc
  .input(zod.object({ id: zod.string() }))
  .output(zod.literal(true));
