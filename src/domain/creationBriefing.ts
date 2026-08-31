import type { ObsidianNote } from "../types";
import { assessSmartKnowledgeReadiness } from "./smartKnowledgeStage2";

export interface CreationBriefing {
  objective: string;
  format: string;
  channel: string;
  theme: string;
  instructions: string;
}

export interface CreationBriefingValidation {
  valid: boolean;
  missing: Array<"objective" | "format" | "channel">;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

export function normalizeCreationBriefing(input: Partial<CreationBriefing>): CreationBriefing {
  return {
    objective: clean(input.objective),
    format: clean(input.format),
    channel: clean(input.channel),
    theme: clean(input.theme),
    instructions: clean(input.instructions),
  };
}

export function validateCreationBriefing(input: Partial<CreationBriefing>): CreationBriefingValidation {
  const briefing = normalizeCreationBriefing(input);
  const missing: CreationBriefingValidation["missing"] = [];
  if (!briefing.objective) missing.push("objective");
  if (!briefing.format) missing.push("format");
  if (!briefing.channel) missing.push("channel");
  return { valid: missing.length === 0, missing };
}

export function buildCreationBriefingInstructions(input: Partial<CreationBriefing>): string {
  const briefing = normalizeCreationBriefing(input);
  const lines: string[] = [];
  if (briefing.theme) lines.push(`Tema informado pelo usuário: ${briefing.theme}`);
  if (briefing.instructions) lines.push(`Restrições ou observações informadas pelo usuário: ${briefing.instructions}`);
  return lines.join("\n");
}

export function creationBriefingBaseStatus(notes: ObsidianNote[]): {
  ready: boolean;
  missingDocuments: number;
  pendingDocuments: number;
} {
  const readiness = assessSmartKnowledgeReadiness(notes);
  return {
    ready: readiness.ready,
    missingDocuments: readiness.ready ? 0 : 1,
    pendingDocuments: readiness.pendingSources,
  };
}
