import { atom, type WritableAtom } from "jotai";

export function atomWithWriteOnly<Args extends unknown[], Result>(
  write: WritableAtom<null, Args, Result>["write"],
) {
  return atom(null, write);
}
