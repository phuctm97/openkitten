import { atomWithPending } from "~/lib/atom-with-pending";
import type { Navigator } from "~/lib/navigator";

export const navigatorAtom = atomWithPending<Navigator>();
