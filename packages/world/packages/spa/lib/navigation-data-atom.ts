import type { Navigation } from "react-router";

import { atomWithPending } from "~/lib/atom-with-pending";

export const navigationDataAtom = atomWithPending<Navigation>();
