import { oc } from "@orpc/contract";
import { workspaceSchema } from "../../workspace-schema";

export const sync = oc.output(workspaceSchema);
