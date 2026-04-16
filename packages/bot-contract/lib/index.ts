import type {
  InferContractRouterInputs,
  InferContractRouterOutputs,
} from "@orpc/contract";
import * as contract from "~/lib/router";

export { contract };

export type ContractInputs = InferContractRouterInputs<typeof contract>;

export type ContractOutputs = InferContractRouterOutputs<typeof contract>;
