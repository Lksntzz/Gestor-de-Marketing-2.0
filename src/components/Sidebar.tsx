import React from "react";
import {
  Home,
  FolderTree,
  SquarePlus,
  CalendarDays,
  SquareTerminal,
  ChartNoAxesCombined,
  Bot,
  Settings,
  Sparkles,
} from "lucide-react";

interface SidebarProps {
  activeTab: "dashboard" | "vault" | "campaigns" | "tasks" | "automations" | "routine" | "knowledge";
  setActiveTab: (tab: "dashboard" | "vault" | "campaigns" | "tasks" | "automations" | "routine" | "knowledge") => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onOpenSettings }) => {
  const navItems = [
    { id: "dashboard" as const, label: "Início", icon: Home },
    { id: "vault" as const, label: "Cofre Obsidian", icon: FolderTree },
    { id: "knowledge" as const, label: "Adicionar Conhecimento", icon: SquarePlus },
    { id: "routine" as const, label: "Planejamento", icon: CalendarDays },
    { id: "tasks" as const, label: "Execução", icon: SquareTerminal },
    { id: "campaigns" as const, label: "Resultados", icon: ChartNoAxesCombined },
    { id: "automations" as const, label: "Automações", icon: Bot },
  ];

  return (
    <aside className="w-20 h-screen sticky top-0 bg-[#1c2028] border-r border-[#334155] flex flex-col items-center py-5 shrink-0 z-30 select-none">
      <button
        type="button"
        onClick={() => setActiveTab("dashboard")}
        className="w-10 h-10 rounded-md bg-[#2563eb] text-white flex items-center justify-center mb-8 hover:bg-blue-500 transition-colors"
        title="Nisti Marketing"
        aria-label="Nisti Marketing - Início"
      >
        <Sparkles className="w-5 h-5" />
      </button>

      <nav className="flex-1 w-full flex flex-col items-center gap-2 overflow-y-auto px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`relative w-12 h-12 rounded-md flex items-center justify-center transition-colors border-l-2 ${
                isActive
                  ? "bg-[#262a33] text-[#b4c5ff] border-[#b4c5ff]"
                  : "text-slate-400 border-transparent hover:text-slate-100 hover:bg-[#262a33]"
              }`}
              title={item.label}
              aria-label={item.label}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onOpenSettings}
        className="w-12 h-12 rounded-md text-slate-400 hover:text-slate-100 hover:bg-[#262a33] flex items-center justify-center transition-colors"
        title="Configurações"
        aria-label="Configurações"
      >
        <Settings className="w-5 h-5" />
      </button>
    </aside>
  );
};
