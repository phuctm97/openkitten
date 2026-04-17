import { atom, type PrimitiveAtom } from "jotai/vanilla";

const pendingValue = new Promise<never>(() => {});

export function atomWithPending<Value>(): PrimitiveAtom<Value> {
  return atom(pendingValue as Value);
}
