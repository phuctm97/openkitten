import { oc } from "@orpc/contract";
import zod from "zod";

const ruleSchema = zod.object({
  id: zod.string(),
  houseId: zod.string(),
  title: zod.string(),
  body: zod.string(),
  enabled: zod.boolean(),
  createdAt: zod.date(),
  updatedAt: zod.date(),
});

export const list = oc.output(zod.array(ruleSchema));

export const get = oc
  .input(zod.object({ id: zod.string() }))
  .output(ruleSchema);

export const create = oc
  .input(
    zod.object({
      title: zod.string().min(1),
      body: zod.string().min(1),
      enabled: zod.boolean().optional(),
    }),
  )
  .output(ruleSchema);

export const update = oc
  .input(
    zod.object({
      id: zod.string(),
      title: zod.string().min(1).optional(),
      body: zod.string().min(1).optional(),
      enabled: zod.boolean().optional(),
    }),
  )
  .output(ruleSchema);

export const remove = oc
  .input(zod.object({ id: zod.string() }))
  .output(zod.literal(true));
