import {
  ObsidianNote,
  MarketingCampaign,
  MarketingTask,
  AutomationRule,
  IdeaItem,
  CreativeScript,
  VisualAsset,
} from "../types";

export const STANDARD_VAULT_FOLDERS = [
  "00_Inbox",
  "01_Estrategia",
  "02_Produtos",
  "03_Conteudos",
  "04_Campanhas",
  "05_Reunioes",
  "06_Influenciadores_UGC",
  "07_Pesquisas",
  "08_Aprendizados",
  "99_Templates",
];

export const DEFAULT_OBSIDIAN_NOTES: ObsidianNote[] = [];

export const DEFAULT_CAMPAIGNS: MarketingCampaign[] = [];

export const DEFAULT_TASKS: MarketingTask[] = [
  {
    id: "task-bf-copy",
    title: "Revisar Copy da Landing Page de Black Friday",
    description: "O documento final foi enviado pela equipe de conteúdo. Precisamos validar os gatilhos mentais na seção de ofertas e confirmar se as promessas estão alinhadas com o estoque atual.",
    channel: "Conteúdo",
    priority: "urgent",
    status: "todo",
    dueDate: "2026-08-26",
    dueTime: "14:00",
    obsidianTaskString: "- [ ] Revisar Copy da Landing Page de Black Friday 📅 2026-08-26 ⏰ 14:00",
    obsidianFilePath: "04_Campanhas/Black_Friday_Copy.md",
    tags: ["copywriting", "black-friday"],
    isReminderActive: true
  },
  {
    id: "task-always-on-creative",
    title: "Aprovar criativos campanha Always-On",
    description: "Validar peças em formato carrossel e stories produzidas pela agência parceira antes do upload nas contas de anúncios.",
    channel: "Design",
    priority: "high",
    status: "todo",
    dueDate: "2026-08-26",
    dueTime: "16:30",
    obsidianTaskString: "- [ ] Aprovar criativos campanha Always-On 📅 2026-08-26 ⏰ 16:30",
    obsidianFilePath: "04_Campanhas/Always_On_Criativos.md",
    tags: ["design", "anuncios"],
    isReminderActive: true
  },
  {
    id: "task-gtm-setup",
    title: "Configurar tags de conversão GTM",
    description: "Instalar e testar os pixels do Facebook Ads e TikTok Ads via Google Tag Manager na nova página de checkout.",
    channel: "Tech",
    priority: "medium",
    status: "todo",
    dueDate: "2026-08-27",
    dueTime: "11:00",
    obsidianTaskString: "- [ ] Configurar tags de conversão GTM 📅 2026-08-27",
    obsidianFilePath: "01_Estrategia/GTM_Setup.md",
    tags: ["gtm", "tech", "analytics"],
    isReminderActive: false
  },
  {
    id: "task-weekly-metrics",
    title: "Revisão semanal de métricas",
    description: "Compilar dados de alcance, CTR, conversões e MQLs do período para o relatório gerencial do cofre.",
    channel: "Admin",
    priority: "medium",
    status: "todo",
    dueDate: "2026-08-28",
    dueTime: "10:00",
    obsidianTaskString: "- [ ] Revisão semanal de métricas 📅 2026-08-28 ⏰ 10:00",
    obsidianFilePath: "01_Estrategia/Metricas_Semanais.md",
    tags: ["metrics", "analytics"],
    isReminderActive: true
  }
];

export const DEFAULT_AUTOMATIONS: AutomationRule[] = [];

export const DEFAULT_AUTOMATION_RULES = DEFAULT_AUTOMATIONS;

export const DEFAULT_IDEAS: IdeaItem[] = [];

export const DEFAULT_SCRIPTS: CreativeScript[] = [];

export const DEFAULT_VISUALS: VisualAsset[] = [];
