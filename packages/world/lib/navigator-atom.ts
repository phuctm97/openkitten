import type { NavigateOptions, To } from "react-router";

import { atomWithPending } from "~/lib/atom-with-pending";

interface Navigator {
  navigate: (to: To, options?: NavigateOptions) => void | Promise<void>;
}

export const navigatorAtom = atomWithPending<Navigator>();
