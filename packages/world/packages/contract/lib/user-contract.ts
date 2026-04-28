import { oc } from "@orpc/contract";
import { userSchema } from "./user-schema";

export const userContract = {
  me: oc.output(userSchema),
};
