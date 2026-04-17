import { oc } from "@orpc/contract";
import zod from "zod";

export const getBotToken = oc.output(zod.string());
