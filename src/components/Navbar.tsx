import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  CheckSquare,
  Settings,
  RefreshCw,
  FolderOpen,
  Zap,
  Layers,
  Calendar,
  Compass,
  Menu,
  X,
  Plus,
  TrendingUp,
  Cpu,
  FileText,
  Lightbulb,
  ExternalLink,
  ChevronDown,
  Check,
  HelpCircle,
  BookOpen,
  Laptop,
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
    const handleClickOutside = (e: MouseEvent) => {
      if (createDropdownRef.current && !createDropdownRef.current.contains(e.target as Node)) {
        setIsCreateDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getStatusBadge = () => {
    if (apiConfig.connectionStatus === "connected") {
      return (
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/60 hover:bg-emerald-100/60 transition-all text-[11px] font-medium cursor-pointer"
          title="Obsidian Local REST API conectado com sucesso"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold truncate max-w-[90px] sm:max-w-none">
            {apiConfig.vaultName || "Obsidian"} Conectado
          </span>
        </button>
      );
    }
    return (
      <button
        onClick={onOpenSettings}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100 text-stone-600 border border-stone-200 hover:bg-stone-200 transition-all text-[11px] font-medium cursor-pointer"
        title="Obsidian ainda não conectado. Clique para configurar a REST API e selecionar o Vault local."
      >
        <span className="w-2 h-2 rounded-full bg-stone-400"></span>
        <span className="truncate max-w-[90px] sm:max-w-none">Obsidian Offline</span>
      </button>
    );
  };

  const navItems = [
    {
      id: "dashboard" as const,
      label: "Início",
      icon: Compass,
      description: "Visão Geral e o que fazer agora",
    },
    {
      id: "vault" as const,
      label: "Cofre Obsidian",
      icon: FolderOpen,
      description: "Cofre Markdown e notas PKM",
    },
    {
      id: "knowledge" as const,
      label: "Adicionar Conhecimento",
      icon: FileText,
      description: "Captura rápida com processamento IA automático",
    },
    {
      id: "routine" as const,
      label: "Planejamento",
      icon: Calendar,
      description: "Rotinas, melhores horários e métricas",
    },
    {
      id: "tasks" as const,
      label: "Execução",
      icon: CheckSquare,
      description: "Centro de Tarefas e Kanban",
    },
    {
      id: "campaigns" as const,
      label: "Resultados",
      icon: Sparkles,
      description: "Assistente de Campanhas e Cópias",
    },
    {
      id: "automations" as const,
      label: "Automações",
      icon: Zap,
      description: "Modelos e sincronização do cofre",
    },
  ];

  const handleTabClick = (tabId: typeof activeTab) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/70">
      <div className="w-full px-4 md:px-8 lg:px-12">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-6">
            <button
              onClick={() => handleTabClick("dashboard")}
              className="flex items-center gap-2.5 text-left group cursor-pointer"
              title="Nisti Marketing — central de operação de marketing da Nisti Print"
            >
              <div className="w-8 h-8 rounded-xl bg-purple-700 text-white flex items-center justify-center shadow-xs group-hover:bg-purple-800 transition-colors">
                <Sparkles className="w-4 h-4 text-purple-200" />
              </div>
              <div className="hidden sm:block">
                <span className="font-black text-stone-900 text-sm tracking-tight block leading-none">
                  Nisti Marketing
                </span>
                <span className="text-[10px] text-stone-400 font-medium leading-tight">
                  Nisti Print
                </span>
              </div>
            </button>

            <nav className="hidden md:flex items-center gap-1 bg-stone-100/70 p-1 rounded-xl border border-stone-200/60">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? "bg-white text-stone-900 shadow-3xs"
                        : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/50"
                    }`}
                    title={item.description}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 ${
                        isActive ? "text-purple-700" : "text-stone-500"
                      }`}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden lg:flex items-center gap-2">
              <button
                onClick={() => onToggleEngineMode(engineMode === "local" ? "gemini" : "local")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  engineMode === "local"
                    ? "bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100"
                    : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                }`}
                title="Alternar entre Motor Local (0 tokens) e Gemini AI"
              >
                <Cpu className="w-3 h-3 text-purple-600" />
                <span>{engineMode === "local" ? "Motor Local" : "IA"}</span>
              </button>

              {getStatusBadge()}
            </div>

            <button
              onClick={onSyncNow}
              disabled={isSyncing}
              className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-all border border-stone-200/60 cursor-pointer disabled:opacity-50"
              title="Sincronizar Cofre Markdown"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-purple-600" : ""}`} />
            </button>

            <div className="relative" ref={createDropdownRef}>
              <button
                onClick={() => setIsCreateDropdownOpen(!isCreateDropdownOpen)}
                className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-purple-400" />
                <span>Criar</span>
                <ChevronDown className="w-3 h-3 text-stone-400" />
              </button>

              {isCreateDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-stone-200/80 shadow-lg py-2 z-50 animate-fadeIn">
                  <div className="px-3 py-1.5 border-b border-stone-100">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                      O que você deseja criar?
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setIsCreateDropdownOpen(false);
                      onQuickNewCampaign();
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-stone-800 hover:bg-purple-50 hover:text-purple-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="block font-bold">Nova Campanha IA</span>
                      <span className="text-[10px] text-stone-500 font-normal">Sintetizar cópias e canais</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setIsCreateDropdownOpen(false);
                      onQuickNewTask();
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-stone-800 hover:bg-purple-50 hover:text-purple-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
                      <CheckSquare className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="block font-bold">Nova Tarefa</span>
                      <span className="text-[10px] text-stone-500 font-normal">Sincronizada com Obsidian Tasks</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setIsCreateDropdownOpen(false);
                      onQuickNewNote();
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-stone-800 hover:bg-purple-50 hover:text-purple-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="block font-bold">Nova Nota PKM</span>
                      <span className="text-[10px] text-stone-500 font-normal">Documento Markdown no cofre</span>
                    </div>
                  </button>

                  {onQuickNewIdea && (
                    <button
                      onClick={() => {
                        setIsCreateDropdownOpen(false);
                        onQuickNewIdea();
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-stone-800 hover:bg-purple-50 hover:text-purple-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <Lightbulb className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="block font-bold">Nova Ideia de Conteúdo</span>
                        <span className="text-[10px] text-stone-500 font-normal">Pauta rápida com gancho</span>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={onOpenSettings}
              className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-all border border-stone-200/60 cursor-pointer"
              title="Configurações (IA, Obsidian, Google Drive)"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 md:hidden text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-all border border-stone-200/60 cursor-pointer"
            >
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-stone-200 bg-white px-4 pt-3 pb-6 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              Navegação
            </span>
            {getStatusBadge()}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`p-3 rounded-xl text-left transition-all flex flex-col justify-between cursor-pointer ${
                    isActive
                      ? "bg-purple-50 border border-purple-200 text-purple-900"
                      : "bg-stone-50 border border-stone-200/60 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <Icon className={`w-4 h-4 mb-2 ${isActive ? "text-purple-700" : "text-stone-500"}`} />
                  <span className="text-xs font-bold">{item.label}</span>
                  <span className="text-[10px] text-stone-500 mt-0.5">{item.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
