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
export const PERSISTENT_STATE_EVENT = "nisti:persistent-state-updated";

function createSourceId(): string {
  return `state-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function usePersistentState<T>(
  key: string,
  fallback: T,
  schema?: SafeParseSchema
): [T, Dispatch<SetStateAction<T>>] {
  const sourceId = useRef(createSourceId());
  const [value, setValue] = useState<T>(() => storage.loadAppState(key, fallback, schema));

  useEffect(() => {
    const handleExternalUpdate = (event: Event) => {
      const detail = (event as CustomEvent<PersistentStateEventDetail>).detail;
      if (!detail || detail.key !== key || detail.sourceId === sourceId.current) return;

      if (schema) {
        const parsed = schema.safeParse(detail.value);
        if (!parsed.success) {
          console.warn(`Ignored invalid synchronized state for key: ${key}`);
          return;
        }
        setValue(parsed.data as T);
        return;
      }

      setValue(detail.value as T);
    };

    window.addEventListener(PERSISTENT_STATE_EVENT, handleExternalUpdate);
    return () => window.removeEventListener(PERSISTENT_STATE_EVENT, handleExternalUpdate);
  }, [key, schema]);

  useEffect(() => {
    storage.saveAppState(key, value);
    window.dispatchEvent(
      new CustomEvent<PersistentStateEventDetail>(PERSISTENT_STATE_EVENT, {
        detail: { key, value, sourceId: sourceId.current },
      })
    );
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
    const handleExternalUpdate = (event: Event) => {
      const detail = (event as CustomEvent<PersistentStateEventDetail>).detail;
      if (!detail || detail.key !== key || detail.sourceId === sourceId.current) return;
      if (typeof detail.value !== "string") return;

      if (schema) {
        const parsed = schema.safeParse(detail.value);
        if (!parsed.success) return;
        setValue(parsed.data as T);
        return;
      }

      setValue(detail.value as T);
    };

    window.addEventListener(PERSISTENT_STATE_EVENT, handleExternalUpdate);
    return () => window.removeEventListener(PERSISTENT_STATE_EVENT, handleExternalUpdate);
  }, [key, schema]);

  useEffect(() => {
    storage.saveTextState(key, value);
    window.dispatchEvent(
      new CustomEvent<PersistentStateEventDetail>(PERSISTENT_STATE_EVENT, {
        detail: { key, value, sourceId: sourceId.current },
      })
    );
  }, [key, value]);

  return [value, setValue];
}
