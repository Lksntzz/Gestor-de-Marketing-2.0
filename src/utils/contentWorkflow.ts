import type { CreativeScript, EditorialItem, EditorialStatus, IdeaItem } from "../types";

export type IdeaDevelopmentSource = Pick<
  IdeaItem,
  | "id"
  | "title"
  | "hook"
  | "format"
  | "channel"
  | "objective"
  | "concept"
  | "keyMessage"
  | "callToAction"
>;

export function buildScriptBriefFromIdea(idea: IdeaDevelopmentSource): string {
  const sections = [
    idea.title.trim(),
    idea.concept?.trim() ? `Conceito: ${idea.concept.trim()}` : "",
    idea.keyMessage?.trim() ? `Mensagem principal: ${idea.keyMessage.trim()}` : "",
    idea.hook?.trim() ? `Gancho: ${idea.hook.trim()}` : "",
    idea.callToAction?.trim() ? `CTA: ${idea.callToAction.trim()}` : "",
  ].filter(Boolean);

  return sections.join("\n\n");
}

export function resolveCreativeScriptType(
  format?: string,
  platform?: string,
): CreativeScript["type"] {
  const normalizedFormat = String(format || "").trim().toLocaleLowerCase("pt-BR");
  const normalizedPlatform = String(platform || "").trim().toLocaleLowerCase("pt-BR");

  if (normalizedFormat.includes("carrossel")) return "carrossel_slide";
  if (normalizedFormat.includes("podcast")) return "podcast_intro";
  if (normalizedFormat.includes("email") || normalizedFormat.includes("newsletter")) return "email_story";
  if (normalizedPlatform.includes("youtube") || normalizedFormat.includes("youtube")) return "video_youtube";
  return "video_reels";
}

interface ExplicitEditorialInput {
  id: string;
  title: string;
  contentType: string;
  platform: string;
  objective: string;
  scheduledDate: string;
  scheduledTime?: string;
  status: EditorialStatus;
  priority?: EditorialItem["priority"];
  ideaId?: string;
  scriptId?: string;
  now?: number;
}

export function buildExplicitEditorialItem(input: ExplicitEditorialInput): EditorialItem {
  const title = input.title.trim();
  const contentType = input.contentType.trim();
  const platform = input.platform.trim();
  const objective = input.objective.trim();
  const scheduledDate = input.scheduledDate.trim();
  const scheduledTime = input.scheduledTime?.trim();

  if (!title) throw new Error("Defina o conteúdo antes de planejar.");
  if (!contentType) throw new Error("Defina o formato antes de planejar.");
  if (!platform) throw new Error("Defina a plataforma antes de planejar.");
  if (!objective) throw new Error("Defina o objetivo antes de planejar.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    throw new Error("Escolha uma data real no calendário antes de planejar.");
  }
  if (scheduledTime && !/^\d{2}:\d{2}$/.test(scheduledTime)) {
    throw new Error("O horário informado é inválido.");
  }

  const now = input.now ?? Date.now();
  return {
    id: input.id,
    title,
    contentType,
    platform,
    objective,
    scheduledDate,
    scheduledTime: scheduledTime || undefined,
    status: input.status,
    priority: input.priority || "medium",
    ideaId: input.ideaId,
    scriptId: input.scriptId,
    createdAt: now,
    updatedAt: now,
  };
}
