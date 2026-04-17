import type { Location } from "react-router";

import { atomWithPending } from "~/lib/atom-with-pending";

export const locationAtom = atomWithPending<Location>();
