import type { useRevalidator } from "react-router";

import { atomWithPending } from "~/lib/atom-with-pending";

type Revalidator = ReturnType<typeof useRevalidator>;

export const revalidatorAtom = atomWithPending<Revalidator>();
