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

function safeSet(storage: Storage, value: string): void {
  try {
    storage.setItem(callbackStorageKey, value);
  } catch {
    return;
  }
}

export function produceCallback(url: string): void {
  const callback = normalizeCallback(retrieveCallback() || url);

  if (!callback || callback === "/") {
    safeRemove(sessionStorage);
    safeRemove(localStorage);
    return;
  }

  safeSet(sessionStorage, callback);
  safeSet(localStorage, callback);
}
