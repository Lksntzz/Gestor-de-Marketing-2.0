import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";
import {
  OBSIDIAN_DISCONNECTED_EVENT,
  OBSIDIAN_SNAPSHOT_EVENT,
  isObsidianRuntimeConnected,
} from "../services/obsidianRuntimeState";
import { APP_STATE_KEYS, StorageManager } from "../services/storage/StorageManager";

type SafeParseSchema = {
  safeParse: (input: unknown) => { success: boolean; data?: unknown };
};

const storage = StorageManager.getInstance();

export function usePersistentState<T>(
  key: string,
  fallback: T,
  schema?: SafeParseSchema
): [T, Dispatch<SetStateAction<T>>] {
  const isKnowledgeBank = key === APP_STATE_KEYS.NOTES;
  const [value, setValue] = useState<T>(() => {
    if (isKnowledgeBank && !isObsidianRuntimeConnected()) {
      return [] as T;
    }
    return storage.loadAppState(key, fallback, schema);
  });

  useEffect(() => {
    if (isKnowledgeBank) return;
    storage.saveAppState(key, value);
  }, [isKnowledgeBank, key, value]);

  useEffect(() => {
    if (!isKnowledgeBank || typeof window === "undefined") return;

    const handleSnapshot = (event: Event) => {
      const detail = (event as CustomEvent<{ notes?: unknown }>).detail;
      if (Array.isArray(detail?.notes)) {
        setValue(detail.notes as T);
      }
    };

    const handleDisconnected = () => {
      setValue([] as T);
    };

    window.addEventListener(OBSIDIAN_SNAPSHOT_EVENT, handleSnapshot as EventListener);
    window.addEventListener(OBSIDIAN_DISCONNECTED_EVENT, handleDisconnected);
    return () => {
      window.removeEventListener(OBSIDIAN_SNAPSHOT_EVENT, handleSnapshot as EventListener);
      window.removeEventListener(OBSIDIAN_DISCONNECTED_EVENT, handleDisconnected);
    };
  }, [isKnowledgeBank]);

  const guardedSetValue = useCallback<Dispatch<SetStateAction<T>>>(
    (nextValue) => {
      if (isKnowledgeBank && !isObsidianRuntimeConnected()) {
        throw new Error("Banco de conhecimento indisponível: conecte o Obsidian antes de ler ou salvar notas.");
      }
      setValue(nextValue);
    },
    [isKnowledgeBank]
  );

  return [value, guardedSetValue];
}

export function usePersistentTextState<T extends string>(
  key: string,
  fallback: T,
  schema?: SafeParseSchema
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => storage.loadTextState(key, fallback, schema));

  useEffect(() => {
    storage.saveTextState(key, value);
  }, [key, value]);

  return [value, setValue];
}
