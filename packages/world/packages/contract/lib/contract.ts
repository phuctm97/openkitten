import { publicContract } from "./public-contract";
import { userContract } from "./user-contract";
import { workspaceContract } from "./workspace";

export const contract = {
  ...publicContract,
  ...userContract,
  workspace: workspaceContract,
};
