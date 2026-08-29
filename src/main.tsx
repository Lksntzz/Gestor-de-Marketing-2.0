import { StrictMode, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { FolderLock, Settings, ShieldCheck } from "lucide-react";
import App from "./App.tsx";
import "./index.css";
import { api } from "./services/api";
import {
  OBSIDIAN_CONNECTED_EVENT,
  OBSIDIAN_DISCONNECTED_EVENT,
  isObsidianRuntimeConnected,
} from "./services/obsidianRuntimeState";
import { StorageManager } from "./services/storage/StorageManager";
import type { ObsidianApiConfig } from "./types";

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
 */
function ObsidianRuntimeGate({ children }: { children: ReactNode }) {
  const isWeb = typeof window !== "undefined" && !window.electronAPI;
  const [connected, setConnected] = useState(() => isWeb || isObsidianRuntimeConnected());
  const [checking, setChecking] = useState(() => !isWeb);
  const [reason, setReason] = useState(
    "Conecte o Obsidian Local REST API e selecione o Vault físico para liberar operações da Base."
  );

  useEffect(() => {
    if (isWeb) {
      setConnected(true);
      setChecking(false);
      return;
    }

    const onConnected = () => {
      setTimeout(() => {
        setConnected(true);
        setChecking(false);
        setReason("");
        triggerVaultSync();
      }, 0);
    };

    const onDisconnected = (event: Event) => {
      const detail = (event as CustomEvent<{ reason?: string }>).detail;
      setTimeout(() => {
        setConnected(false);
        setChecking(false);
        setReason(detail?.reason || "A conexão com o Obsidian foi perdida.");
      }, 0);
    };

    window.addEventListener(OBSIDIAN_CONNECTED_EVENT, onConnected);
    window.addEventListener(OBSIDIAN_DISCONNECTED_EVENT, onDisconnected as EventListener);

    void (async () => {
      try {
        const config = await storage.loadApiConfig(DEFAULT_API_CONFIG);
        const vaultPath = window.electronAPI ? await window.electronAPI.getVaultPath() : null;

        if (config.endpoint?.trim() && config.apiKey?.trim() && (!window.electronAPI || vaultPath)) {
          const result = await api.probeObsidianConnection({
            endpoint: config.endpoint,
            apiKey: config.apiKey,
          });

          if (!result.success) {
            setReason(result.message || "Não foi possível validar o Obsidian.");
            setConnected(false);
          }
        } else {
          setConnected(false);
        }
      } catch (err: any) {
        setReason(err?.message || "Não foi possível validar o Obsidian.");
        setConnected(false);
      } finally {
        setChecking(false);
      }
    })();

    return () => {
      window.removeEventListener(OBSIDIAN_CONNECTED_EVENT, onConnected);
      window.removeEventListener(OBSIDIAN_DISCONNECTED_EVENT, onDisconnected as EventListener);
    };
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
                  ? "Verificando a REST API e o Vault físico. As áreas locais continuam disponíveis."
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
      <App />
    </ObsidianRuntimeGate>
  </StrictMode>
);
