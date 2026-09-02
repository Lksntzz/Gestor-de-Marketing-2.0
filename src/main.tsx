import { StrictMode, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { FolderLock, Settings, ShieldCheck } from "lucide-react";
import App from "./App.tsx";
import "./index.css";
import { BaseInitialGate } from "./components/BaseInitialGate";
import { api } from "./services/api";
import { ensureAIConnectionMetadataMigration } from "./services/ai/AIConnectionMetadataStore";
import { installLegacyTaskImportGuard } from "./services/legacyTaskImportGuard";
import { installVerifiedObsidianWriteGuard } from "./services/verifiedObsidianWriteGuard";
import {
  OBSIDIAN_CONNECTED_EVENT,
  OBSIDIAN_DISCONNECTED_EVENT,
  isObsidianRuntimeConnected,
  publishObsidianSnapshot,
} from "./services/obsidianRuntimeState";
import { StorageManager } from "./services/storage/StorageManager";
import type { ObsidianApiConfig } from "./types";

installLegacyTaskImportGuard(api);
installVerifiedObsidianWriteGuard(api);

const storage = StorageManager.getInstance();
const DEFAULT_API_CONFIG: ObsidianApiConfig = {
  endpoint: "https://127.0.0.1:27124",
  apiKey: "",
  geminiApiKey: "",
  openaiApiKey: "",
  aiProvider: "gemini",
  aiModel: "",
  vaultName: "MarketingVault",
  useHttps: true,
  autoSync: true,
  syncIntervalSeconds: 60,
  connectionStatus: "disconnected",
  allowSelfSignedCerts: true,
};

const OBSIDIAN_RECONNECT_MIN_DELAY_MS = 3_000;
const OBSIDIAN_RECONNECT_MAX_DELAY_MS = 30_000;
const OBSIDIAN_RECONNECT_CONNECTED_POLL_MS = 5_000;

function reconnectDelayForAttempt(attempt: number): number {
  if (attempt <= 0) return OBSIDIAN_RECONNECT_MIN_DELAY_MS;
  return Math.min(
    OBSIDIAN_RECONNECT_MIN_DELAY_MS * (2 ** Math.min(attempt, 4)),
    OBSIDIAN_RECONNECT_MAX_DELAY_MS,
  );
}

function clickSettingsButton() {
  const button = document.querySelector('button[title="Configurações"]') as HTMLButtonElement | null;
  button?.click();
}

function triggerVaultSync() {
  window.setTimeout(() => {
    const button = document.querySelector('button[title="Sincronizar Cofre Markdown"]') as HTMLButtonElement | null;
    if (button && !button.disabled) button.click();
  }, 500);
}

/**
 * Tracks the authenticated Obsidian runtime without blocking the whole product.
 *
 * Vault reads/writes remain fail-closed in the API, StorageManager and Electron
 * authorization boundary. Local-only work (for example task execution) must
 * remain usable while the knowledge runtime is disconnected.
 *
 * Desktop reconnect is intentionally continuous: a persisted endpoint/key must
 * be revalidated automatically after restart, and opening Obsidian later must
 * recover the session without requiring the user to click "Testar conexão".
 */
function ObsidianRuntimeGate({ children }: { children: ReactNode }) {
  const isWeb = typeof window !== "undefined" && !window.electronAPI;
  const [connected, setConnected] = useState(() => isWeb || isObsidianRuntimeConnected());
  const [checking, setChecking] = useState(() => !isWeb);
  const [reason, setReason] = useState(
    "Conecte o Obsidian Local REST API para liberar operações da Base."
  );

  useEffect(() => {
    if (isWeb) {
      setConnected(true);
      setChecking(false);
      return;
    }

    let disposed = false;
    let reconnectTimer: number | null = null;
    let reconnectAttempts = 0;
    let reconnectBusy = false;
    let initialProbeFinished = false;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = (delayMs: number) => {
      if (disposed) return;
      clearReconnectTimer();
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        void reconnect();
      }, delayMs);
    };

    const reconnect = async () => {
      if (disposed || reconnectBusy) return;

      if (isObsidianRuntimeConnected()) {
        reconnectAttempts = 0;
        setConnected(true);
        setChecking(false);
        scheduleReconnect(OBSIDIAN_RECONNECT_CONNECTED_POLL_MS);
        return;
      }

      reconnectBusy = true;
      if (!initialProbeFinished) setChecking(true);

      try {
        const config = await storage.loadApiConfig(DEFAULT_API_CONFIG);
        ensureAIConnectionMetadataMigration(config);

        // REST-first desktop mode does not require a selected physical Vault path
        // to authenticate. The endpoint and the safely persisted API key are the
        // authoritative prerequisites for reconnecting to Obsidian Local REST API.
        const hasSavedConnection = Boolean(config.endpoint?.trim() && config.apiKey?.trim());
        if (!hasSavedConnection) {
          setConnected(false);
          setReason("Configure o endpoint e a API Key do Obsidian para conectar a Base.");
          reconnectAttempts = 0;
          scheduleReconnect(OBSIDIAN_RECONNECT_MAX_DELAY_MS);
          return;
        }

        const result = await api.probeObsidianConnection({
          endpoint: config.endpoint,
          apiKey: config.apiKey,
        });

        if (disposed) return;

        if (result.success) {
          reconnectAttempts = 0;
          setConnected(true);
          setReason("");
          triggerVaultSync();
          scheduleReconnect(OBSIDIAN_RECONNECT_CONNECTED_POLL_MS);
          return;
        }

        reconnectAttempts += 1;
        setConnected(false);
        setReason(result.message || "Não foi possível validar o Obsidian. Tentaremos novamente automaticamente.");
        scheduleReconnect(reconnectDelayForAttempt(reconnectAttempts));
      } catch (err: any) {
        if (disposed) return;
        reconnectAttempts += 1;
        setConnected(false);
        setReason(
          err?.message ||
          "Obsidian indisponível no momento. O Nisti tentará reconectar automaticamente.",
        );
        scheduleReconnect(reconnectDelayForAttempt(reconnectAttempts));
      } finally {
        reconnectBusy = false;
        initialProbeFinished = true;
        if (!disposed) setChecking(false);
      }
    };

    const onConnected = () => {
      reconnectAttempts = 0;
      setTimeout(() => {
        if (disposed) return;
        setConnected(true);
        setChecking(false);
        setReason("");
        triggerVaultSync();
        scheduleReconnect(OBSIDIAN_RECONNECT_CONNECTED_POLL_MS);
      }, 0);
    };

    const onDisconnected = (event: Event) => {
      const detail = (event as CustomEvent<{ reason?: string }>).detail;
      reconnectAttempts = 0;
      setTimeout(() => {
        if (disposed) return;
        setConnected(false);
        setChecking(false);
        setReason(
          detail?.reason ||
          "A conexão com o Obsidian foi perdida. Tentaremos reconectar automaticamente.",
        );
        scheduleReconnect(OBSIDIAN_RECONNECT_MIN_DELAY_MS);
      }, 0);
    };

    window.addEventListener(OBSIDIAN_CONNECTED_EVENT, onConnected);
    window.addEventListener(OBSIDIAN_DISCONNECTED_EVENT, onDisconnected as EventListener);

    void reconnect();

    return () => {
      disposed = true;
      clearReconnectTimer();
      window.removeEventListener(OBSIDIAN_CONNECTED_EVENT, onConnected);
      window.removeEventListener(OBSIDIAN_DISCONNECTED_EVENT, onDisconnected as EventListener);
    };
  }, [isWeb]);

  useEffect(() => {
    if (isWeb || !window.electronAPI?.onVaultSnapshot) return;
    return window.electronAPI.onVaultSnapshot((snapshot) => {
      if (!Array.isArray(snapshot?.notes)) return;
      publishObsidianSnapshot(
        snapshot.notes,
        Array.isArray(snapshot.folders) ? snapshot.folders : [],
      );
    });
  }, [isWeb]);

  return (
    <>
      {children}

      {!connected && !isWeb && (
        <div className="fixed bottom-4 right-4 z-40 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-amber-500/25 bg-[#111827]/95 shadow-2xl backdrop-blur-md p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              {checking ? (
                <ShieldCheck className="w-4 h-4 text-amber-300 animate-pulse" />
              ) : (
                <FolderLock className="w-4 h-4 text-amber-300" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-xs font-black text-white">
                {checking ? "Validando a Base..." : "Base desconectada"}
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                {checking
                  ? "Verificando a REST API. As áreas locais continuam disponíveis."
                  : reason}
              </p>

              {!checking && (
                <button
                  type="button"
                  onClick={clickSettingsButton}
                  className="mt-3 px-3 py-2 rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-200 text-[10px] font-black flex items-center gap-1.5"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Configurar Base
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const msg = event.reason?.message || String(event.reason || "");
    if (
      msg.includes("WebSocket") ||
      msg.includes("websocket") ||
      msg.includes("WS ") ||
      msg.includes("HMR")
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn("Suppressed benign sandbox WebSocket error:", msg);
    }
  });

  window.addEventListener("error", (event) => {
    const msg = event.message || "";
    if (
      msg.includes("WebSocket") ||
      msg.includes("websocket") ||
      msg.includes("WS ") ||
      msg.includes("HMR")
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn("Suppressed benign sandbox WebSocket error:", msg);
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ObsidianRuntimeGate>
      <BaseInitialGate>
        <App />
      </BaseInitialGate>
    </ObsidianRuntimeGate>
  </StrictMode>
);
