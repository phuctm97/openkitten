import type { Context } from "effect";
import { tagPrefix } from "~/lib/tag-prefix";

export const getTag = <I, V>(tag: Context.Tag<I, V>) =>
  tag.key.slice(tagPrefix.length);
