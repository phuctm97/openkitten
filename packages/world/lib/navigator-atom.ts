import { atomWithPending } from "~/lib/atom-with-pending";
import type { Navigator } from "~/lib/nativator";

export const navigatorAtom = atomWithPending<Navigator>();
