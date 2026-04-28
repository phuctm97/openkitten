import { atom, type WritableAtom } from "jotai";

export function atomWithReadOnly<Value, Args extends unknown[], Result>(
  writableAtom: WritableAtom<Value, Args, Result>,
) {
  return atom((get) => get(writableAtom));
}
