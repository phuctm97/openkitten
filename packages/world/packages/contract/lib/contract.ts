import { publicContract } from "./public-contract";
import { userContract } from "./user-contract";

export const contract = {
  ...publicContract,
  ...userContract,
};
