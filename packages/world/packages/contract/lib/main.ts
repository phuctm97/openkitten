import type {
  InferContractRouterInputs,
  InferContractRouterOutputs,
} from "@orpc/contract";
import { contract } from "./contract";

export { publicContract } from "./public-contract";
export { userContract } from "./user-contract";
export { userSchema } from "./user-schema";
export { workspaceContract } from "./workspace";
export { contract };

export type ContractInputs = InferContractRouterInputs<typeof contract>;
export type ContractOutputs = InferContractRouterOutputs<typeof contract>;
