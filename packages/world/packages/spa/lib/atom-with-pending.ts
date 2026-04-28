import { atom, type PrimitiveAtom } from "jotai/vanilla";

const pending = new Promise<never>(() => {});

export function atomWithPending<Value>(): PrimitiveAtom<Value> {
  return atom(pending as Value);
}
