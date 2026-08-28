import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { StorageManager } from "../services/storage/StorageManager";

type SafeParseSchema = {
  safeParse: (input: unknown) => { success: boolean; data?: unknown };
};

type PersistentStateEventDetail = {
  key: string;
  value: unknown;
  sourceId: string;
};

const storage = StorageManager.getInstance();

export const APP_STATE_CHANGED_EVENT = "nisti:app-state-changed";
export const PERSISTENT_STATE_EVENT = "nisti:persistent-state-updated";

function createSourceId(): string {
  return `state-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function publishStateChange<T>(key: string, value: T, sourceId: string): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<PersistentStateEventDetail>(PERSISTENT_STATE_EVENT, {
      detail: { key, value, sourceId },
    })
  );
  window.dispatchEvent(new CustomEvent(APP_STATE_CHANGED_EVENT, { detail: { key } }));
}

export function usePersistentState<T>(
  key: string,
  fallback: T,
  schema?: SafeParseSchema
): [T, Dispatch<SetStateAction<T>>] {
  const sourceId = useRef(createSourceId());
  const [value, setValue] = useState<T>(() => storage.loadAppState(key, fallback, schema));

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleExternalUpdate = (event: Event) => {
      const detail = (event as CustomEvent<PersistentStateEventDetail>).detail;
      if (!detail || detail.key !== key || detail.sourceId === sourceId.current) return;

      if (schema) {
        const parsed = schema.safeParse(detail.value);
        if (!parsed.success) {
          console.warn(`Ignored invalid synchronized state for key: ${key}`);
          return;
        }
        setValue((prev) => JSON.stringify(prev) === JSON.stringify(parsed.data) ? prev : parsed.data as T);
        return;
      }

      setValue((prev) => JSON.stringify(prev) === JSON.stringify(detail.value) ? prev : detail.value as T);
    };

    window.addEventListener(PERSISTENT_STATE_EVENT, handleExternalUpdate);
    return () => window.removeEventListener(PERSISTENT_STATE_EVENT, handleExternalUpdate);
  }, [key, schema]);

  useEffect(() => {
    storage.saveAppState(key, value);
    publishStateChange(key, value, sourceId.current);
  }, [key, value]);

  return [value, setValue];
}

export function usePersistentTextState<T extends string>(
  key: string,
  fallback: T,
  schema?: SafeParseSchema
): [T, Dispatch<SetStateAction<T>>] {
  const sourceId = useRef(createSourceId());
  const [value, setValue] = useState<T>(() => storage.loadTextState(key, fallback, schema));

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleExternalUpdate = (event: Event) => {
      const detail = (event as CustomEvent<PersistentStateEventDetail>).detail;
      if (!detail || detail.key !== key || detail.sourceId === sourceId.current) return;
      if (typeof detail.value !== "string") return;

      if (schema) {
        const parsed = schema.safeParse(detail.value);
        if (!parsed.success) return;
        setValue((prev) => JSON.stringify(prev) === JSON.stringify(parsed.data) ? prev : parsed.data as T);
        return;
      }

      setValue((prev) => JSON.stringify(prev) === JSON.stringify(detail.value) ? prev : detail.value as T);
    };

    window.addEventListener(PERSISTENT_STATE_EVENT, handleExternalUpdate);
    return () => window.removeEventListener(PERSISTENT_STATE_EVENT, handleExternalUpdate);
  }, [key, schema]);

  useEffect(() => {
    storage.saveTextState(key, value);
    publishStateChange(key, value, sourceId.current);
  }, [key, value]);

  return [value, setValue];
}
