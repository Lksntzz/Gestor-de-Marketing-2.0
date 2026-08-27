import React from "react";
import {
  Compass,
  FolderOpen,
  FileText,
  Calendar,
  CheckSquare,
  Sparkles,
  Zap,
  Settings,
  ChevronDown,
} from "lucide-react";

interface SidebarProps {
  activeTab: "dashboard" | "vault" | "campaigns" | "tasks" | "automations" | "routine" | "knowledge";
  setActiveTab: (tab: "dashboard" | "vault" | "campaigns" | "tasks" | "automations" | "routine" | "knowledge") => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSettings,
}) => {
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

  return (
    <aside className="w-64 bg-[#0B0D1B] text-slate-400 flex flex-col h-screen sticky top-0 border-r border-slate-800/40 shrink-0 z-30 select-none">
      {/* Brand Header */}
      <div className="p-6 pb-4 border-b border-slate-800/30 flex items-center gap-3">
        {/* Nisti Print Ribbon SVG Logo */}
        <div className="shrink-0">
          <svg className="w-9 h-9" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M10 26C10 26 13 14 17 14C21 14 21.5 26 25 26C28.5 26 31 14 31 14"
              stroke="url(#nisti-pink-grad)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="nisti-pink-grad" x1="10" y1="14" x2="31" y2="26" gradientUnits="userSpaceOnUse">
                <stop stopColor="#F43F5E" />
                <stop stopColor="#D946EF" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div>
          <h1 className="font-black text-white text-base tracking-tight leading-none uppercase">
            Nisti
            <span className="text-[10px] font-extrabold text-pink-500 block leading-tight tracking-widest mt-0.5">
              PRINT
            </span>
          </h1>
          <span className="text-[9px] text-slate-500 font-bold block mt-1 uppercase tracking-wider">
            Marketing Hub
          </span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-600">
            Pipeline de Ingestão PKM
          </span>
        </div>
        
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-3 relative cursor-pointer text-left ${
                isActive
                  ? "bg-white/5 text-white shadow-sm"
                  : "hover:text-white hover:bg-white/2"
              }`}
              title={item.description}
            >
              {/* Left active border marker */}
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-pink-500" />
              )}
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? "text-pink-500" : "text-slate-500"
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Settings & Profile */}
      <div className="p-4 border-t border-slate-800/40 space-y-3">
        {/* Settings Tab / Trigger */}
        <button
          onClick={onOpenSettings}
          className="w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-3 hover:text-white hover:bg-white/2 cursor-pointer text-left"
        >
          <Settings className="w-4 h-4 text-slate-500 shrink-0" />
          <span>Configurações</span>
        </button>

        {/* Profile Card */}
        <div className="p-3 bg-slate-900/50 rounded-2xl border border-slate-800/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* NP Avatar */}
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-xl bg-pink-600/10 border border-pink-500/25 text-pink-500 flex items-center justify-center font-bold text-xs">
                NP
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0B0D1B]"></span>
            </div>
            {/* User Name / Subtitle */}
            <div className="min-w-0">
              <h4 className="text-xs font-extrabold text-white truncate">
                Nisti Print
              </h4>
              <p className="text-[10px] text-slate-500 truncate mt-0.5">
                Marketing
              </p>
            </div>
          </div>
          {/* Dropdown Indicator */}
          <ChevronDown className="w-3.5 h-3.5 text-slate-600 shrink-0" />
        </div>
      </div>
    </aside>
  );
};
