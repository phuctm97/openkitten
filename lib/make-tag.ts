import { tagPrefix } from "~/lib/tag-prefix";

export const makeTag = (name: string) => `${tagPrefix}${name}`;
