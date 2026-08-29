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

export type PrimaryNavigationIcon = "home" | "base" | "create" | "plan" | "execute";

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
 * Legacy views can remain addressable internally during the refactor, but they
 * are deliberately absent as primary destinations until their data/functions
 * are migrated to the target architecture.
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
    matches: ["campaigns", "editorial", "routine"],
  },
  {
    id: "tasks",
    label: "Executar",
    description: "Tarefas operacionais",
    icon: "execute",
    matches: ["tasks", "automations"],
  },
] as const;

/**
 * The only permanent subnavigation kept in Phase 1.
 * Knowledge ingestion is opened as an action inside Base, while routine and
 * automation views remain compatibility routes only.
 */
export const PLANNING_SUBNAVIGATION: readonly ProductSubNavigationItem[] = [
  { id: "campaigns", label: "Campanhas" },
  { id: "editorial", label: "Calendário" },
] as const;

export const LEGACY_COMPATIBILITY_VIEWS: readonly AppViewId[] = [
  "knowledge",
  "routine",
  "automations",
] as const;

export function isPrimaryNavigationDestination(view: AppViewId): boolean {
  return PRIMARY_NAVIGATION.some((item) => item.id === view);
}

export function isPlanningSubnavigationView(view: AppViewId): boolean {
  return PLANNING_SUBNAVIGATION.some((item) => item.id === view);
}
