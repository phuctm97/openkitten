import type {
  InferContractRouterInputs,
  InferContractRouterOutputs,
} from "@orpc/contract";
import { contract } from "./contract";

export { getBotToken } from "./get-bot-token";
export { contract };

export type ContractInputs = InferContractRouterInputs<typeof contract>;
export type ContractOutputs = InferContractRouterOutputs<typeof contract>;
