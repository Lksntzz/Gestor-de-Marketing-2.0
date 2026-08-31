import React from "react";
import {
  BarChart3,
  Compass,
  FolderOpen,
  Calendar,
  CheckSquare,
  Sparkles,
  Settings,
} from "lucide-react";
import {
  PRIMARY_NAVIGATION,
  type PrimaryNavigationIcon,
} from "../navigation/productNavigation";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  onOpenSettings: () => void;
}

const NAV_ICONS: Record<PrimaryNavigationIcon, React.ComponentType<{ className?: string }>> = {
  home: Compass,
  base: FolderOpen,
  create: Sparkles,
  plan: Calendar,
  execute: CheckSquare,
  learn: BarChart3,
};

const NistiBrandMark = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 160 160"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Nisti Print"
  >
    <path
      d="M49 18C49 13 55 9 63 9C80 9 91 18 101 30C108 39 112 49 115 59C103 50 91 43 82 38C71 33 61 31 52 32C48 29 47 24 49 18Z"
      fill="#FF95BA"
      stroke="#FFD2E2"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path
      d="M71 46C56 47 37 51 23 60C14 66 9 76 12 84C14 91 18 96 23 98C31 101 40 94 48 79C55 66 61 55 71 46Z"
      fill="#30CED0"
      stroke="#A9ECEC"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path
      d="M77 79C73 91 66 103 60 114C55 124 54 135 59 143C64 151 75 154 84 150C91 147 95 141 93 134C90 123 82 113 78 103C75 95 75 87 77 79Z"
      fill="#FFF164"
      stroke="#FFF9BA"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path
      d="M128 49C135 47 142 50 147 56C152 63 153 69 150 76C146 84 139 92 130 99C127 101 124 101 122 100C126 91 129 82 129 73C129 65 126 58 126 53C126 51 127 50 128 49Z"
      fill="#C8C9CB"
      stroke="#E3E5E7"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSettings,
}) => {
  return (
    <aside className="w-20 bg-[#0B0D1B] text-slate-400 flex flex-col h-screen sticky top-0 border-r border-slate-800/40 shrink-0 z-30 select-none items-center">
      <div className="py-6 border-b border-slate-800/30 flex justify-center w-full shrink-0">
        <div className="shrink-0 cursor-pointer" title="Nisti Print - Marketing Hub">
          <NistiBrandMark className="w-11 h-11" />
        </div>
      </div>

      <nav className="flex-1 w-full px-2 py-6 flex flex-col items-center gap-3 overflow-y-auto scrollbar-hide">
        {PRIMARY_NAVIGATION.map((item) => {
          const Icon = NAV_ICONS[item.icon];
          const isActive = item.matches.includes(activeTab as any);
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
              aria-label={item.label}
            >
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

      <div className="p-4 border-t border-slate-800/40 flex flex-col items-center gap-4 w-full shrink-0">
        <button
          onClick={onOpenSettings}
          className="w-12 h-12 rounded-xl transition-all flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/2 cursor-pointer"
          title="Configurações"
          aria-label="Configurações"
        >
          <Settings className="w-5 h-5 shrink-0" />
        </button>

        <div className="relative shrink-0 cursor-pointer" title="Nisti Print - Marketing Hub">
          <div className="w-11 h-11 flex items-center justify-center">
            <NistiBrandMark className="w-10 h-10" />
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0B0D1B]"></span>
        </div>
      </div>
    </aside>
  );
};
