const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

code = code.replace(/interface SidebarProps \{[\s\S]*?\}/, `interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  onOpenSettings: () => void;
}`);

const newNavItems = `  const navItems = [
    {
      id: "dashboard" as const,
      label: "Início",
      icon: Compass,
      description: "Visão Geral",
      match: ["dashboard"]
    },
    {
      id: "vault" as const, // sets to vault by default
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
      description: "Calendário, Tarefas e Rotina",
      match: ["editorial", "tasks", "routine"]
    },
    {
      id: "automations" as const,
      label: "Automações",
      icon: Zap,
      description: "Modelos e Regras",
      match: ["automations"]
    },
  ];`;

code = code.replace(/const navItems = \[[\s\S]*?\];/, newNavItems);
code = code.replace(/const isActive = activeTab === item\.id;/, "const isActive = item.match.includes(activeTab as any);");

fs.writeFileSync('src/components/Sidebar.tsx', code);
