import { callbackStorageKey } from "~/lib/callback-storage-key";
import { normalizeCallback } from "~/lib/normalize-callback";
import { retrieveCallback } from "~/lib/retrieve-callback";

function safeRemove(storage: Storage): void {
  try {
    storage.removeItem(callbackStorageKey);
  } catch {
    return;
  }
}

export function consumeCallback(): string {
  const callback = normalizeCallback(retrieveCallback());
  safeRemove(sessionStorage);
  safeRemove(localStorage);
  return callback;
}
