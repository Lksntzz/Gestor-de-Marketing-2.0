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
      id: "content" as const,
      label: "Ideias e Roteiros",
      icon: Sparkles, // can use Lightbulb if imported, or something else. Wait, Lightbulb is not imported, I'll use FileText or just let me import Lightbulb
      description: "Geração inteligente de conteúdo",
    },
    {
      id: "automations" as const,
      label: "Automações",
      icon: Zap,
      description: "Modelos e sincronização do cofre",
    },
  ];

  return (
    <aside className="w-20 bg-[#0B0D1B] text-slate-400 flex flex-col h-screen sticky top-0 border-r border-slate-800/40 shrink-0 z-30 select-none items-center">
      {/* Brand Header */}
      <div className="py-6 border-b border-slate-800/30 flex justify-center w-full shrink-0">
        {/* Nisti Print Ribbon SVG Logo */}
        <div className="shrink-0 cursor-pointer" title="Nisti Print - Marketing Hub">
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
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 w-full px-2 py-6 flex flex-col items-center gap-3 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-12 h-12 rounded-xl transition-all flex items-center justify-center relative cursor-pointer group ${
                isActive
                  ? "bg-white/5 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/2"
              }`}
              title={`${item.label} - ${item.description}`}
            >
              {/* Left active border marker */}
              {isActive && (
                <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-pink-500" />
              )}
              <Icon
                className={`w-5 h-5 shrink-0 transition-colors ${
                  isActive ? "text-pink-500" : "text-slate-400 group-hover:text-white"
                }`}
              />
            </button>
          );
        })}
      </nav>

      {/* Bottom Settings & Profile */}
      <div className="p-4 border-t border-slate-800/40 flex flex-col items-center gap-4 w-full shrink-0">
        {/* Settings Tab / Trigger */}
        <button
          onClick={onOpenSettings}
          className="w-12 h-12 rounded-xl transition-all flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/2 cursor-pointer"
          title="Configurações"
        >
          <Settings className="w-5 h-5 shrink-0" />
        </button>

        {/* Profile Avatar Card */}
        <div className="relative shrink-0 cursor-pointer" title="Nisti Print - Marketing Hub">
          <div className="w-10 h-10 rounded-xl bg-pink-600/10 border border-pink-500/25 text-pink-500 flex items-center justify-center font-bold text-xs">
            NP
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0B0D1B]"></span>
        </div>
      </div>
    </aside>
  );
};
