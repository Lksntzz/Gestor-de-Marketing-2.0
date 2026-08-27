import React, { useEffect, useRef, useState } from "react";
import {
  Bot,
  CheckSquare,
  ChevronDown,
  FileText,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  X,
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
  onQuickNewIdea,
  engineMode,
  onToggleEngineMode,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false);
  const createDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (createDropdownRef.current && !createDropdownRef.current.contains(event.target as Node)) {
        setIsCreateDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navItems = [
    { id: "dashboard" as const, label: "Início" },
    { id: "vault" as const, label: "Cofre Obsidian" },
    { id: "knowledge" as const, label: "Adicionar Conhecimento" },
    { id: "routine" as const, label: "Planejamento" },
    { id: "tasks" as const, label: "Execução" },
    { id: "campaigns" as const, label: "Resultados" },
    { id: "automations" as const, label: "Automações" },
  ];

  const obsidianConnected = apiConfig.connectionStatus === "connected";
  const engineIsLocal = engineMode === "local";

  return (
    <header className="sticky top-0 z-20 h-16 bg-[#0f131c] border-b border-[#334155] select-none">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((value) => !value)}
            className="lg:hidden w-9 h-9 rounded-md border border-[#334155] text-slate-300 flex items-center justify-center hover:bg-[#1c2028]"
            aria-label="Abrir navegação"
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="search"
              placeholder="Buscar notas, campanhas, tarefas..."
              className="w-full h-9 rounded-md border border-[#334155] bg-[#181c24] pl-9 pr-3 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-[#64748b] focus:ring-1 focus:ring-[#64748b]/30"
            />
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.12em]">
          <button
            type="button"
            onClick={() => onToggleEngineMode(engineIsLocal ? "gemini" : "local")}
            className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors"
            title="Alternar motor de IA"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            {engineIsLocal ? "Local" : "Gemini"}
          </button>
          <span className="text-slate-600">•</span>
          <button
            type="button"
            onClick={onOpenSettings}
            className={`flex items-center gap-1.5 transition-colors ${obsidianConnected ? "text-emerald-400 hover:text-emerald-300" : "text-slate-500 hover:text-slate-300"}`}
            title="Configuração do Obsidian"
          >
            <span className={`w-2 h-2 rounded-full ${obsidianConnected ? "bg-emerald-400" : "bg-slate-600"}`} />
            Obsidian
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onSyncNow}
            disabled={isSyncing}
            className="w-9 h-9 rounded-md text-slate-300 hover:text-white hover:bg-[#1c2028] border border-transparent hover:border-[#334155] flex items-center justify-center disabled:opacity-50"
            title="Sincronizar"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-9 h-9 rounded-md text-slate-300 hover:text-white hover:bg-[#1c2028] border border-transparent hover:border-[#334155] flex items-center justify-center"
            title="Configurações"
          >
            <Settings className="w-4 h-4" />
          </button>

          <div className="relative" ref={createDropdownRef}>
            <button
              type="button"
              onClick={() => setIsCreateDropdownOpen((value) => !value)}
              className="h-9 px-4 rounded-md bg-[#2563eb] hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Criar</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {isCreateDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-md border border-[#334155] bg-[#1c2028] shadow-2xl p-1.5 z-50">
                <button
                  type="button"
                  onClick={() => { onQuickNewCampaign(); setIsCreateDropdownOpen(false); }}
                  className="w-full px-3 py-2 rounded text-left text-xs text-slate-200 hover:bg-[#262a33] flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-blue-400" /> Nova campanha
                </button>
                <button
                  type="button"
                  onClick={() => { onQuickNewTask(); setIsCreateDropdownOpen(false); }}
                  className="w-full px-3 py-2 rounded text-left text-xs text-slate-200 hover:bg-[#262a33] flex items-center gap-2"
                >
                  <CheckSquare className="w-4 h-4 text-emerald-400" /> Nova tarefa
                </button>
                <button
                  type="button"
                  onClick={() => { onQuickNewNote(); setIsCreateDropdownOpen(false); }}
                  className="w-full px-3 py-2 rounded text-left text-xs text-slate-200 hover:bg-[#262a33] flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-violet-400" /> Nova nota
                </button>
                {onQuickNewIdea && (
                  <button
                    type="button"
                    onClick={() => { onQuickNewIdea(); setIsCreateDropdownOpen(false); }}
                    className="w-full px-3 py-2 rounded text-left text-xs text-slate-200 hover:bg-[#262a33] flex items-center gap-2"
                  >
                    <Bot className="w-4 h-4 text-cyan-400" /> Nova ideia
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="lg:hidden absolute left-0 right-0 top-16 border-b border-[#334155] bg-[#0f131c] p-3 shadow-2xl">
          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                className={`px-3 py-2 rounded-md text-left text-xs font-semibold border ${
                  activeTab === item.id
                    ? "bg-[#262a33] text-[#b4c5ff] border-[#4f5d78]"
                    : "bg-[#181c24] text-slate-300 border-[#334155]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};
