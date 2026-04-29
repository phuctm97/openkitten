import * as definition from "@openkitten/world-contract";
import { implement } from "@orpc/server";

export const contract = implement(definition).$context<{
  headers: Headers;
}>();
