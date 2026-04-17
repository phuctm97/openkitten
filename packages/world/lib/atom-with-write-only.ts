import { atom, type Write } from "jotai";

export function atomWithWriteOnly<Args extends unknown[], Result>(
  write: Write<(...args: Args) => Result, Args, Result>,
) {
  return atom((_, { setSelf }) => setSelf, write);
}
