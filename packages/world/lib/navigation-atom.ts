import type { Navigation } from "react-router";

import { atomWithPending } from "~/lib/atom-with-pending";

export const navigationAtom = atomWithPending<Navigation>();
