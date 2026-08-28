import React, { useState, useRef, useEffect } from "react";
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
  Lightbulb,
  ChevronDown,
  Search,
  Bell,
} from "lucide-react";
import { ObsidianApiConfig, EngineMode, MarketingTask } from "../types";

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
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
  tasks?: MarketingTask[];
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
  tasks = [],
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notifications = tasks.filter(t => t.priority === "urgent" && t.status !== "done");
  const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false);
  const createDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-900 border border-purple-200/50 hover:bg-purple-100/50 transition-all text-xs font-bold cursor-pointer shrink-0"
          title="Obsidian Local REST API conectado com sucesso"
        >
          {/* Obsidian Gemstone icon */}
          <svg className="w-3.5 h-3.5 text-purple-700 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 9L12 22L22 9L12 2ZM12 4.5L18.5 9L12 13.5L5.5 9L12 4.5ZM12 19.5L5 10L12 15L19 10L12 19.5Z" />
          </svg>
          <span className="truncate max-w-[120px] sm:max-w-none">
            {apiConfig.vaultName || "Obsidian"} Conectado
          </span>
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </button>
      );
    }
    return (
      <button
        onClick={onOpenSettings}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-150 text-stone-700 border border-stone-250 hover:bg-stone-200 transition-all text-xs font-bold cursor-pointer shrink-0"
        title="Modo local simulado. Clique para conectar a REST API do Obsidian."
      >
        <span className="w-2 h-2 rounded-full bg-stone-400 shrink-0"></span>
        <span className="truncate max-w-[100px] sm:max-w-none">Modo IA</span>
      </button>
    );
  };

  const navItems = [
    {
      id: "dashboard" as const,
      label: "Início",
      icon: Compass,
      description: "Visão Geral",
      match: ["dashboard"]
    },
    {
      id: "vault" as const,
      label: "Cofre de Conhecimento",
      icon: FolderOpen,
      description: "Arquivos e Input",
      match: ["vault", "knowledge"]
    },
    {
      id: "content" as const,
      label: "Estúdio de Criação",
      icon: Sparkles,
      description: "Ideias e Campanhas",
      match: ["content", "campaigns"]
    },
    {
      id: "editorial" as const,
      label: "Planejamento e Execução",
      icon: Calendar,
      description: "Calendário, Tarefas e Rotinas",
      match: ["editorial", "tasks", "routine"]
    },
    {
      id: "automations" as const,
      label: "Automações",
      icon: Zap,
      description: "Modelos e Regras",
      match: ["automations"]
    },
  ];

  const handleTabClick = (tabId: typeof activeTab) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-20 w-full bg-surface border-b border-outline-border select-none">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Left Block: Search Bar (Desktop) & Logo (Mobile) */}
          <div className="flex items-center gap-4 flex-1">
            {/* Mobile Logo Brand */}
            <button
              onClick={() => handleTabClick("dashboard")}
              className="lg:hidden flex items-center gap-2 text-left group cursor-pointer"
            >
              <svg className="w-8 h-8 shrink-0" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M10 26C10 26 13 14 17 14C21 14 21.5 26 25 26C28.5 26 31 14 31 14"
                  stroke="url(#mob-nisti-pink-grad)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <defs>
                  <linearGradient id="mob-nisti-pink-grad" x1="10" y1="14" x2="31" y2="26" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#F43F5E" />
                    <stop stopColor="#D946EF" />
                  </linearGradient>
                </defs>
              </svg>
              <div>
                <span className="font-black text-stone-900 text-xs tracking-tight block leading-none">
                  Nisti Print
                </span>
                <span className="text-[9px] text-pink-500 font-extrabold tracking-widest block mt-0.5 uppercase">
                  Marketing Hub
                </span>
              </div>
            </button>

            {/* Desktop Unified Search Bar inside the Header */}
            <div className="hidden lg:flex items-center relative w-full max-w-md">
              <Search className="w-4 h-4 text-text-secondary absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar conhecimento, campanhas, tarefas, notas... ⌘ K"
                className="w-full pl-10 pr-4 py-2 bg-surface-container-low hover:bg-surface-variant text-xs font-medium text-text-primary placeholder-text-secondary rounded-2xl border border-outline-border focus:outline-none focus:ring-1 focus:ring-motor-info focus:border-motor-info transition-all"
              />
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* Status & Engine Badge */}
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={() => onToggleEngineMode(engineMode === "local" ? "gemini" : "local")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs ${
                  engineMode === "local"
                    ? "bg-surface-container-low text-text-primary border-outline-border hover:bg-surface-variant"
                    : "bg-pink-950/40 text-pink-200 border-pink-900/50 hover:bg-pink-900/30"
                }`}
                title="Alternar entre Motor Local (0 tokens) e IA configurada"
              >
                <Cpu className="w-3.5 h-3.5 text-text-secondary" />
                <span>{engineMode === "local" ? "Motor Local" : "IA"}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </button>

              {getStatusBadge()}
            </div>

            {/* Notification Bell with Badge */}
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 bg-surface-container-low hover:bg-surface-variant text-text-secondary hover:text-text-primary rounded-xl transition-all border border-outline-border cursor-pointer relative"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-error-sober text-[9px] font-bold text-white flex items-center justify-center border border-background">
                    {notifications.length > 9 ? "9+" : notifications.length}
                  </span>
                )}
              </button>
              
              {isNotificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-surface-card border border-outline-border rounded-xl shadow-lg z-50 overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-outline-border bg-surface-container-low">
                    <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                      Notificações
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto no-scrollbar flex flex-col p-2">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-text-secondary text-xs">
                        Nenhuma notificação nova.
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div key={notif.id} className="p-3 hover:bg-surface-elevated rounded-lg transition-colors cursor-pointer border-b border-outline-border/30 last:border-0 flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-error-sober/10 flex items-center justify-center shrink-0">
                            <Bell className="w-4 h-4 text-error-sober" />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-text-primary leading-tight">
                              Tarefa Urgente
                            </span>
                            <span className="text-[11px] text-text-secondary leading-snug">
                              {notif.title}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sync Now Button */}
            <button
              onClick={onSyncNow}
              disabled={isSyncing}
              className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-variant text-text-secondary hover:text-text-primary rounded-xl transition-all border border-outline-border cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              title="Sincronizar Cofre Markdown"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-pink-600" : "text-text-secondary"}`} />
              <span className="text-xs font-bold hidden md:inline">Sincronizar</span>
            </button>

            {/* UNIFIED "+ CRIAR" BUTTON WITH DROPDOWN */}
            <div className="relative" ref={createDropdownRef}>
              <button
                onClick={() => {
                  if (apiConfig.connectionStatus !== "connected") {
                    onQuickNewNote(); // Triggers the offline warning and opens settings via App.tsx handlers
                    return;
                  }
                  setIsCreateDropdownOpen(!isCreateDropdownOpen);
                }}
                className={`px-4 py-2 ${
                  apiConfig.connectionStatus === "connected"
                    ? "bg-pink-600 hover:bg-pink-500 text-white"
                    : "bg-stone-200 text-stone-600 hover:bg-stone-300"
                } text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer`}
              >
                {apiConfig.connectionStatus === "connected" ? (
                  <>
                    <Plus className="w-3.5 h-3.5 text-white" />
                    <span>Criar</span>
                    <ChevronDown className="w-3 h-3 text-white/80" />
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>Criar Bloqueado</span>
                  </>
                )}
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

            {/* Gear Button for settings (only on mobile, as desktop has it in the Sidebar) */}
            <button
              onClick={onOpenSettings}
              className="p-2 lg:hidden text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-all border border-stone-200/60 cursor-pointer"
              title="Configurações"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Mobile Menu Toggle (Hamburger) */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 lg:hidden text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-all border border-stone-200/60 cursor-pointer"
            >
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

          </div>
        </div>
      </div>

      {/* Mobile Slide-out / Dropdown Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-stone-200 bg-white px-4 pt-3 pb-6 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              Navegação
            </span>
            {getStatusBadge()}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.match.includes(activeTab as any);
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`p-3 rounded-xl text-left transition-all flex flex-col justify-between cursor-pointer ${
                    isActive
                      ? "bg-pink-50 border border-pink-200 text-pink-950"
                      : "bg-stone-50 border border-stone-200/60 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <Icon className={`w-4 h-4 mb-2 ${isActive ? "text-pink-600" : "text-stone-500"}`} />
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
