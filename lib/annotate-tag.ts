import type { Context } from "effect";
import { Effect } from "effect";
import { getTag } from "~/lib/get-tag";

export function annotateTag<I, V>(tag: Context.Tag<I, V>) {
  return Effect.annotateLogs("service", getTag(tag));
}
