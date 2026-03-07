import type { Context } from "effect";
import { tagPrefix } from "~/lib/tag-prefix";

export function getTag<I, V>(tag: Context.Tag<I, V>) {
  return tag.key.slice(tagPrefix.length);
}
