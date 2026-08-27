import { StrictMode, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { FolderLock, Settings, ShieldCheck } from "lucide-react";
import App from "./App.tsx";
import "./index.css";
import { api } from "./services/api";
import { startAutomationRuntime, stopAutomationRuntime } from "./services/automationRuntime";
import {
  OBSIDIAN_CONNECTED_EVENT,
  OBSIDIAN_DISCONNECTED_EVENT,
  isObsidianRuntimeConnected,
} from "./services/obsidianRuntimeState";
import { StorageManager } from "./services/storage/StorageManager";
import type { ObsidianApiConfig } from "./types";

const storage = StorageManager.getInstance();
const DEFAULT_API_CONFIG: ObsidianApiConfig = {
  endpoint: "http://127.0.0.1:27124",
  apiKey: "",
  geminiApiKey: "",
  vaultName: "MarketingVault",
  useHttps: false,
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

function ObsidianRuntimeGate({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(() => isObsidianRuntimeConnected());
  const [checking, setChecking] = useState(true);
  const [reason, setReason] = useState("Conecte o Obsidian Local REST API e selecione o Vault físico para liberar o banco de conhecimento.");

  useEffect(() => {
    startAutomationRuntime();
    return () => stopAutomationRuntime();
  }, []);

  useEffect(() => {
    const onConnected = () => {
      setConnected(true);
      setChecking(false);
      setReason("");
      triggerVaultSync();
    };
    const onDisconnected = (event: Event) => {
      const detail = (event as CustomEvent<{ reason?: string }>).detail;
      setConnected(false);
      setChecking(false);
      setReason(detail?.reason || "A conexão com o Obsidian foi perdida.");
    };

    window.addEventListener(OBSIDIAN_CONNECTED_EVENT, onConnected);
    window.addEventListener(OBSIDIAN_DISCONNECTED_EVENT, onDisconnected as EventListener);

    void (async () => {
      try {
        const config = await storage.loadApiConfig(DEFAULT_API_CONFIG);
        const vaultPath = window.electronAPI ? await window.electronAPI.getVaultPath() : null;
        if (config.endpoint?.trim() && config.apiKey?.trim() && (!window.electronAPI || vaultPath)) {
          const result = await api.probeObsidianConnection({ endpoint: config.endpoint, apiKey: config.apiKey });
          if (!result.success) {
            setReason(result.message || "Não foi possível validar o Obsidian.");
            setConnected(false);
          }
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
  }, []);

  return (
    <>
      {children}
      {!connected && (
        <div className="fixed inset-0 z-40 bg-[#0f131c]/88 backdrop-blur-sm flex items-center justify-center p-5">
          <div className="w-full max-w-lg rounded-2xl border border-[#334155] bg-[#111827] shadow-2xl p-7 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-pink-500/10 border border-pink-500/25 flex items-center justify-center mb-4">
              {checking ? <ShieldCheck className="w-7 h-7 text-pink-400 animate-pulse" /> : <FolderLock className="w-7 h-7 text-pink-400" />}
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-400">Banco de conhecimento protegido</span>
            <h1 className="text-xl font-black text-white mt-2">{checking ? "Validando o Obsidian..." : "Obsidian desconectado"}</h1>
            <p className="text-xs text-slate-400 leading-relaxed mt-3">{checking ? "Verificando a REST API e a pasta física do Vault antes de liberar o sistema." : reason}</p>
            {!checking && (
              <>
                <div className="mt-5 p-3 rounded-xl bg-[#0f131c] border border-[#334155] text-left text-[11px] text-slate-400 leading-relaxed">
                  Sem essa validação, o Nisti Marketing não lê, cria ou altera conhecimento, nem usa o conteúdo do Vault para gerar decisões.
                </div>
                <button type="button" onClick={clickSettingsButton} className="mt-5 w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black flex items-center justify-center gap-2">
                  <Settings className="w-4 h-4" />
                  Configurar e conectar Obsidian
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const msg = event.reason?.message || String(event.reason || "");
    if (msg.includes("WebSocket") || msg.includes("websocket") || msg.includes("WS ") || msg.includes("HMR")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn("Suppressed benign sandbox WebSocket error:", msg);
    }
  });

  window.addEventListener("error", (event) => {
    const msg = event.message || "";
    if (msg.includes("WebSocket") || msg.includes("websocket") || msg.includes("WS ") || msg.includes("HMR")) {
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
