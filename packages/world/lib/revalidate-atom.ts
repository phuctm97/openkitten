import { atomWithWriteOnly } from "~/lib/atom-with-write-only";
import { revalidatorAtom } from "~/lib/revalidator-atom";

export const revalidateAtom = atomWithWriteOnly(async (get) => {
  const revalidator = get(revalidatorAtom);
  await revalidator.revalidate();
});
