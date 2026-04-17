import { atomWithPending } from "~/lib/atom-with-pending";
import type { Revalidator } from "~/lib/revalidator";

export const revalidatorAtom = atomWithPending<Revalidator>();
