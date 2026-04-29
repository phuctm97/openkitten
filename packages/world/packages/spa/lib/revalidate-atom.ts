import { atomWithWriteOnly } from "~/lib/atom-with-write-only";
import { queryClient } from "~/lib/query-client";
import { revalidatorAtom } from "~/lib/revalidator-atom";

export const revalidateAtom = atomWithWriteOnly(async (get) => {
  const revalidator = get(revalidatorAtom);
  await queryClient.cancelQueries();
  await queryClient.resetQueries();
  await revalidator.revalidate();
});
