import type * as jotai from "jotai";

declare module "jotai" {
  type Store = ReturnType<typeof jotai.createStore>;
  type Read<Value> = jotai.Atom<Value>["read"];
  type Write<Value, Args extends unknown[], Result> = jotai.WritableAtom<
    Value,
    Args,
    Result
  >["write"];
}
