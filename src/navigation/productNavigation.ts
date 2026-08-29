export type AppViewId =
  | "dashboard"
  | "vault"
  | "knowledge"
  | "content"
  | "campaigns"
  | "editorial"
  | "tasks"
  | "routine"
  | "automations";

export type PrimaryNavigationIcon = "home" | "base" | "create" | "plan" | "execute" | "learn";

export interface PrimaryNavigationItem {
  id: AppViewId;
  label: string;
  description: string;
  icon: PrimaryNavigationIcon;
  matches: readonly AppViewId[];
}

export interface ProductSubNavigationItem {
  id: AppViewId;
  label: string;
}

/**
 * Primary product navigation after the product audit.
 *
 * Each destination maps to a distinct job in the marketing workflow. Legacy
 * compatibility routes stay addressable internally but do not get navigation
 * entries of their own.
 */
export const PRIMARY_NAVIGATION: readonly PrimaryNavigationItem[] = [
  {
    id: "dashboard",
    label: "Início",
    description: "Prioridades e bloqueios",
    icon: "home",
    matches: ["dashboard"],
  },
  {
    id: "vault",
    label: "Base",
    description: "Conhecimento e fontes",
    icon: "base",
    matches: ["vault", "knowledge"],
  },
  {
    id: "content",
    label: "Criar",
    description: "Ideias e conteúdo",
    icon: "create",
    matches: ["content"],
  },
  {
    id: "editorial",
    label: "Planejar",
    description: "Campanhas e calendário",
    icon: "plan",
    matches: ["campaigns", "editorial"],
  },
  {
    id: "tasks",
    label: "Executar",
    description: "Tarefas operacionais",
    icon: "execute",
    matches: ["tasks", "automations"],
  },
  {
    id: "routine",
    label: "Aprender",
    description: "Resultados e evidências",
    icon: "learn",
    matches: ["routine"],
  },
] as const;

/**
 * Planning keeps only the two surfaces that materially change the plan.
 */
export const PLANNING_SUBNAVIGATION: readonly ProductSubNavigationItem[] = [
  { id: "campaigns", label: "Campanhas" },
  { id: "editorial", label: "Calendário" },
] as const;

export const LEGACY_COMPATIBILITY_VIEWS: readonly AppViewId[] = [
  "knowledge",
  "automations",
] as const;

export function isPrimaryNavigationDestination(view: AppViewId): boolean {
  return PRIMARY_NAVIGATION.some((item) => item.id === view);
}

export function isPlanningSubnavigationView(view: AppViewId): boolean {
  return PLANNING_SUBNAVIGATION.some((item) => item.id === view);
}
