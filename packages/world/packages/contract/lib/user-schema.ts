import zod from "zod";

export const userSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  email: zod.string(),
  emailVerified: zod.boolean(),
  image: zod.string().nullish(),
  createdAt: zod.date(),
  updatedAt: zod.date(),
});
