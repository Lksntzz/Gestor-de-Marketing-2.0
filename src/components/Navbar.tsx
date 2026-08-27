import React, { useMemo, useState } from "react";
import {
  Sparkles,
  CheckSquare,
  Settings,
  RefreshCw,
  FolderOpen,
  Zap,
  Calendar,
  Compass,
  Menu,
  X,
  Plus,
  Cpu,
  FileText,
  BarChart3,
  Wifi,
  WifiOff,
} from "lucide-react";
import { ObsidianApiConfig, EngineMode } from "../types";

interface NavbarProps {
  activeTab: "dashboard" | "vault" | "campaigns" | "tasks" | "automations" | "routine" | "knowledge";
  setActiveTab: (tab: "dashboard" | "vault" | "campaigns" | "tasks" | "automations" | "routine" | "knowledge") => void;
  apiConfig: ObsidianApiConfig;
  onOpenSettings: () => void;
  onSyncNow: () => void;
  isSyncing: boolean;
  onQuickNewCampaign: () => void;
  onQuickNewTask: () => void;
  onQuickNewNote: () => void;
  onQuickNewIdea?: () => void;
  hasApiKey: boolean;
  engineMode: EngineMode;
  onToggleEngineMode: (mode: EngineMode) => void;
}

const APP_SHELL_WIDTH = 232;

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  apiConfig,
  onOpenSettings,
  onSyncNow,
  isSyncing,
  onQuickNewCampaign,
  onQuickNewTask,
  onQuickNewNote,
  hasApiKey,
  engineMode,
  onToggleEngineMode,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const isConnected = apiConfig.connectionStatus === "connected";

  const navItems = useMemo(
    () => [
      { id: "dashboard" as const, label: "Início", icon: Compass },
      { id: "vault" as const, label: "Cofre Obsidian", icon: FolderOpen },
      { id: "knowledge" as const, label: "Adicionar Conhecimento", icon: FileText },
      { id: "routine" as const, label: "Planejamento", icon: Calendar },
      { id: "tasks" as const, label: "Execução", icon: CheckSquare },
      { id: "campaigns" as const, label: "Resultados", icon: BarChart3 },
      { id: "automations" as const, label: "Automações", icon: Zap },
    ],
    []
  );

  const navigate = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setMobileOpen(false);
  };

  const navContent = (
    <>
      <div className="px-4 pt-5 pb-4 border-b border-stone-200/70">
        <button onClick={() => navigate("dashboard")} className="flex items-center gap-3 text-left w-full">
          <div className="w-9 h-9 rounded-xl bg-purple-700 text-white flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-black text-stone-950 leading-tight">Nisti Marketing</div>
            <div className="text-[10px] text-stone-500 mt-0.5">Central de operação</div>
          </div>
        </button>
      </div>

      <nav className="px-3 py-4 space-y-1 flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const selected = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`w-full h-10 px-3 rounded-xl flex items-center gap-3 text-xs font-semibold transition-colors ${
                selected
                  ? "bg-purple-50 text-purple-950 border border-purple-200"
                  : "text-stone-600 hover:text-stone-950 hover:bg-stone-100 border border-transparent"
              }`}
            >
              <Icon className={`w-4 h-4 ${selected ? "text-purple-700" : "text-stone-400"}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-stone-200/70 space-y-2">
        <button
          onClick={() => onToggleEngineMode(engineMode === "local" ? "gemini" : "local")}
          className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 flex items-center justify-between text-left"
        >
          <span className="flex items-center gap-2 text-[11px] font-bold text-stone-700">
            <Cpu className="w-3.5 h-3.5 text-purple-600" />
            {engineMode === "local" ? "Motor Local" : "Gemini IA"}
          </span>
          <span className={`w-2 h-2 rounded-full ${engineMode === "local" || hasApiKey ? "bg-emerald-500" : "bg-amber-500"}`} />
        </button>

        <button
          onClick={onSyncNow}
          disabled={!isConnected || isSyncing}
          className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-45 flex items-center gap-2 text-[11px] font-bold text-stone-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-purple-600" : "text-stone-500"}`} />
          {isSyncing ? "Sincronizando..." : "Sincronizar Vault"}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setCreateOpen((v) => !v)}
            className="px-3 py-2.5 rounded-xl bg-stone-900 text-white text-[11px] font-bold flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Criar
          </button>
          <button
            onClick={onOpenSettings}
            className="px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-700 text-[11px] font-bold flex items-center justify-center gap-1.5"
          >
            <Settings className="w-3.5 h-3.5" /> Ajustes
          </button>
        </div>

        {createOpen && (
          <div className="rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg space-y-1">
            <button onClick={() => { setCreateOpen(false); onQuickNewNote(); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 text-[11px] font-semibold">Nova nota</button>
            <button onClick={() => { setCreateOpen(false); onQuickNewTask(); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 text-[11px] font-semibold">Nova tarefa</button>
            <button onClick={() => { setCreateOpen(false); onQuickNewCampaign(); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 text-[11px] font-semibold">Nova campanha</button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      <style>{`
        html, body, #root { height: 100%; overflow: hidden; }
        @media (min-width: 768px) {
          #root > div { padding-left: ${APP_SHELL_WIDTH}px; height: 100vh; overflow: hidden; }
        }
      `}</style>

      <aside className="hidden md:flex fixed inset-y-0 left-0 z-50 w-[232px] bg-white border-r border-stone-200/80 flex-col">
        {navContent}
      </aside>

      <header className="md:hidden sticky top-0 z-50 h-14 bg-white border-b border-stone-200 flex items-center justify-between px-4">
        <button onClick={() => navigate("dashboard")} className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-700 text-white flex items-center justify-center"><Sparkles className="w-4 h-4" /></div>
          <span className="text-sm font-black">Nisti Marketing</span>
        </button>
        <button onClick={() => setMobileOpen((v) => !v)} className="p-2 rounded-lg border border-stone-200">
          {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </header>

      {mobileOpen && (
        <div className="md:hidden fixed inset-x-0 top-14 bottom-8 z-40 bg-white flex flex-col border-t border-stone-100">
          {navContent}
        </div>
      )}

      <div className="fixed left-0 md:left-[232px] right-0 bottom-0 z-50 h-8 bg-white/95 backdrop-blur border-t border-stone-200 flex items-center justify-between px-3 md:px-5 text-[10px] text-stone-500">
        <div className="flex items-center gap-2 min-w-0">
          {isConnected ? <Wifi className="w-3 h-3 text-emerald-600" /> : <WifiOff className="w-3 h-3 text-stone-400" />}
          <span className="font-semibold text-stone-700">Obsidian {isConnected ? "conectado" : "offline"}</span>
          <span className="hidden sm:inline text-stone-300">•</span>
          <span className="hidden sm:inline truncate">{apiConfig.vaultName || "Vault não selecionado"}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span>{engineMode === "local" ? "Motor Local" : hasApiKey ? "Gemini ativo" : "Gemini sem chave"}</span>
          {apiConfig.lastSyncTime && <span className="hidden lg:inline">• última sync {new Date(apiConfig.lastSyncTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
        </div>
      </div>
    </>
  );
};
