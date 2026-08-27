import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { StorageManager } from "../services/storage/StorageManager";

type SafeParseSchema = {
  safeParse: (input: unknown) => { success: boolean; data?: unknown };
};

const storage = StorageManager.getInstance();

export const APP_STATE_CHANGED_EVENT = "nisti:app-state-changed";

function publishStateChange(key: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(APP_STATE_CHANGED_EVENT, { detail: { key } }));
}

export function usePersistentState<T>(
  key: string,
  fallback: T,
  schema?: SafeParseSchema
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => storage.loadAppState(key, fallback, schema));

  useEffect(() => {
    storage.saveAppState(key, value);
    publishStateChange(key);
  }, [key, value]);

  return [value, setValue];
}

export function usePersistentTextState<T extends string>(
  key: string,
  fallback: T,
  schema?: SafeParseSchema
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => storage.loadTextState(key, fallback, schema));

  useEffect(() => {
    storage.saveTextState(key, value);
    publishStateChange(key);
  }, [key, value]);

  return [value, setValue];
}
