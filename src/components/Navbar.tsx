import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  Calendar,
  CheckSquare,
  ChevronDown,
  Compass,
  FileText,
  FolderOpen,
  Lightbulb,
  Menu,
  Plus,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import type { EngineMode, MarketingTask, ObsidianApiConfig } from "../types";
import {
  PRIMARY_NAVIGATION,
  type PrimaryNavigationIcon,
} from "../navigation/productNavigation";
import { EDITORIAL_PLANNING_REQUEST_EVENT } from "../services/editorialPlanningHandoff";
import { NistiLogo, NistiLogoIcon } from "./NistiLogo";

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

const NAV_ICONS: Record<PrimaryNavigationIcon, React.ComponentType<{ className?: string }>> = {
  home: Compass,
  base: FolderOpen,
  create: Sparkles,
  plan: Calendar,
  execute: CheckSquare,
  learn: BarChart3,
};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  apiConfig,
  onOpenSettings,
  onQuickNewCampaign,
  onQuickNewTask,
  onQuickNewNote,
  onQuickNewIdea,
  tasks = [],
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false);
  const createDropdownRef = useRef<HTMLDivElement>(null);

  const notifications = useMemo(
    () => tasks.filter((task) => task.priority === "urgent" && task.status !== "done"),
    [tasks],
  );
  const isBaseConnected = apiConfig.connectionStatus === "connected";
  const currentArea = useMemo(
    () => PRIMARY_NAVIGATION.find((item) => item.matches.includes(activeTab as any)),
    [activeTab],
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (createDropdownRef.current && !createDropdownRef.current.contains(event.target as Node)) {
        setIsCreateDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const openEditorialPlanning = () => {
      setActiveTab("editorial");
      setIsMobileMenuOpen(false);
      setIsCreateDropdownOpen(false);
    };
    window.addEventListener(EDITORIAL_PLANNING_REQUEST_EVENT, openEditorialPlanning);
    return () => window.removeEventListener(EDITORIAL_PLANNING_REQUEST_EVENT, openEditorialPlanning);
  }, [setActiveTab]);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  const connectionWarning = !isBaseConnected ? (
    <button
      type="button"
      onClick={onOpenSettings}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/25 hover:bg-amber-500/15 transition-all text-[11px] font-bold cursor-pointer shrink-0"
      title="A Base está desconectada. Abra Configurações para revisar o Obsidian."
    >
      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
      <span>Base desconectada</span>
    </button>
  ) : null;

  return (
    <header className="sticky top-0 z-20 w-full bg-surface border-b border-outline-border select-none">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => handleTabClick("dashboard")}
              className="lg:hidden flex items-center gap-2 text-left group cursor-pointer shrink-0"
              aria-label="Ir para Início"
            >
              <NistiLogo size="sm" />
            </button>

            <div className="hidden lg:block min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#7FD0D1]">Nisti Print Hub</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#FF95BA]/15 text-[#FF95BA] font-bold border border-[#FF95BA]/25">PKM 2.0</span>
              </div>
              <div className="text-sm font-black text-text-primary truncate">{currentArea?.label || "Workspace"}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden md:block">{connectionWarning}</div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationsOpen((open) => !open)}
                className="p-2 bg-surface-container-low hover:bg-surface-variant text-text-secondary hover:text-text-primary rounded-xl transition-all border border-outline-border cursor-pointer relative"
                aria-label="Notificações"
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
                    <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Notificações</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto no-scrollbar flex flex-col p-2">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-text-secondary text-xs">Nenhuma notificação nova.</div>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className="p-3 hover:bg-surface-elevated rounded-lg transition-colors border-b border-outline-border/30 last:border-0 flex items-start gap-3"
                        >
                          <div className="w-8 h-8 rounded-full bg-error-sober/10 flex items-center justify-center shrink-0">
                            <Bell className="w-4 h-4 text-error-sober" />
                          </div>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-xs font-bold text-text-primary leading-tight">Tarefa urgente</span>
                            <span className="text-[11px] text-text-secondary leading-snug break-words">{notification.title}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={createDropdownRef}>
              <button
                type="button"
                onClick={() => setIsCreateDropdownOpen((open) => !open)}
                className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                aria-expanded={isCreateDropdownOpen}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Criar</span>
                <ChevronDown className="w-3 h-3 text-white/80" />
              </button>

              {isCreateDropdownOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-surface-card rounded-2xl border border-outline-border shadow-lg py-2 z-50 animate-fadeIn">
                  <div className="px-3 py-1.5 border-b border-outline-border">
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Criar</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateDropdownOpen(false);
                      if (!isBaseConnected) {
                        onOpenSettings();
                        return;
                      }
                      onQuickNewCampaign();
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-text-primary hover:bg-surface-elevated flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-300 flex items-center justify-center shrink-0">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="block font-bold">Nova campanha</span>
                      <span className="text-[10px] text-text-secondary font-normal">
                        {isBaseConnected ? "Planejar estratégia e canais" : "Requer Base conectada"}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateDropdownOpen(false);
                      if (!isBaseConnected) {
                        handleTabClick("tasks");
                        return;
                      }
                      onQuickNewTask();
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-text-primary hover:bg-surface-elevated flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-surface-elevated text-text-secondary flex items-center justify-center shrink-0">
                      <CheckSquare className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="block font-bold">Nova tarefa</span>
                      <span className="text-[10px] text-text-secondary font-normal">
                        {isBaseConnected ? "Registrar uma ação operacional" : "Abrir Execução — funciona sem Base"}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateDropdownOpen(false);
                      if (!isBaseConnected) {
                        onOpenSettings();
                        return;
                      }
                      onQuickNewNote();
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-text-primary hover:bg-surface-elevated flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-surface-elevated text-text-secondary flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="block font-bold">Nova nota</span>
                      <span className="text-[10px] text-text-secondary font-normal">
                        {isBaseConnected ? "Adicionar conhecimento ao cofre" : "Requer Base conectada"}
                      </span>
                    </div>
                  </button>

                  {onQuickNewIdea && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreateDropdownOpen(false);
                        onQuickNewIdea();
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-text-primary hover:bg-surface-elevated flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-300 flex items-center justify-center shrink-0">
                        <Lightbulb className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="block font-bold">Nova ideia</span>
                        <span className="text-[10px] text-text-secondary font-normal">Registrar uma pauta rápida</span>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2 lg:hidden text-text-secondary hover:text-text-primary hover:bg-surface-variant rounded-xl transition-all border border-outline-border cursor-pointer"
              title="Configurações"
              aria-label="Configurações"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              className="p-2 lg:hidden text-text-secondary hover:text-text-primary hover:bg-surface-variant rounded-xl transition-all border border-outline-border cursor-pointer"
              aria-label={isMobileMenuOpen ? "Fechar navegação" : "Abrir navegação"}
            >
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-outline-border bg-surface px-4 pt-3 pb-6 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-outline-border">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Navegação</span>
            {connectionWarning}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {PRIMARY_NAVIGATION.map((item) => {
              const Icon = NAV_ICONS[item.icon];
              const isActive = item.matches.includes(activeTab as any);
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  aria-label={item.label}
                  className={`p-3 rounded-xl text-left transition-all flex flex-col justify-between cursor-pointer ${
                    isActive
                      ? "bg-pink-500/10 border border-pink-500/25 text-text-primary"
                      : "bg-surface-container-low border border-outline-border text-text-secondary hover:bg-surface-variant"
                  }`}
                >
                  <Icon className={`w-4 h-4 mb-2 ${isActive ? "text-pink-500" : "text-text-secondary"}`} />
                  <span className="text-xs font-bold">{item.label}</span>
                  <span className="text-[10px] text-text-secondary mt-0.5">{item.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
