import { tagPrefix } from "~/lib/tag-prefix";

export function makeTag(name: string) {
  return `${tagPrefix}${name}`;
}
