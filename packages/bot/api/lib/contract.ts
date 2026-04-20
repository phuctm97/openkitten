import { oc } from "@orpc/contract";
import zod from "zod";

export const contract = {
  getBotToken: oc.output(zod.string()),
};
