import type { Context } from "effect";
import { Effect } from "effect";
import { getTag } from "~/lib/get-tag";

export const annotateTag = <I, V>(tag: Context.Tag<I, V>) =>
  Effect.annotateLogs("service", getTag(tag));
