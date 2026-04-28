import { callbackStorageKey } from "~/lib/callback-storage-key";

function readCallback(storage: Storage): string {
  try {
    const value = storage.getItem(callbackStorageKey);
    return value && value !== "/" ? value : "";
  } catch {
    return "";
  }
}

export function retrieveCallback(): string {
  return readCallback(sessionStorage) || readCallback(localStorage);
}
