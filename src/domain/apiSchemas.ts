/**
 * apiSchemas.ts
 *
 * Esquemas de validação Zod para endpoints de API HTTP e contratos IPC.
 */
import { z } from "zod";

// -------------------------------------------------------------
// AI Request Schemas
// -------------------------------------------------------------

export const GenerateIdeasRequestSchema = z.object({
  objective: z.string().min(1, "Objetivo é obrigatório"),
  format: z.string().min(1, "Formato é obrigatório"),
  channel: z.string().min(1, "Canal é obrigatório"),
  count: z.number().int().min(1).max(20).optional().default(3),
  theme: z.string().optional().default(""),
  customInstructions: z.string().optional().default(""),
  engineMode: z.enum(["local", "gemini", "openai"]).optional(),
  knowledgeSources: z.array(z.string()).optional().default([]),
});

export const GenerateScriptRequestSchema = z.object({
  idea: z.object({
    title: z.string().min(1, "Título da ideia é obrigatório"),
    format: z.string().optional().default(""),
    channel: z.string().optional().default(""),
    hook: z.string().optional().default(""),
    concept: z.string().optional().default(""),
    cta: z.string().optional().default(""),
  }).passthrough(),
  tone: z.string().optional().default("Profissional"),
  targetDuration: z.string().optional().default("60s"),
  engineMode: z.enum(["local", "gemini", "openai"]).optional(),
  knowledgeSources: z.array(z.string()).optional().default([]),
});

export const GenerateCampaignRequestSchema = z.object({
  name: z.string().min(1, "Nome da campanha é obrigatório"),
  objective: z.string().min(1, "Objetivo é obrigatório"),
  targetAudience: z.string().min(1, "Público-alvo é obrigatório"),
  targetTone: z.string().optional().default("Profissional"),
  channels: z.array(z.string()).min(1, "Ao menos um canal é obrigatório"),
  engineMode: z.enum(["local", "gemini", "openai"]).optional(),
  knowledgeSources: z.array(z.string()).optional().default([]),
});

export const GenerateGuidelinesRequestSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  brandVoice: z.string().optional().default(""),
  targetAudience: z.string().optional().default(""),
  coreValues: z.array(z.string()).optional().default([]),
  engineMode: z.enum(["local", "gemini", "openai"]).optional(),
  knowledgeSources: z.array(z.string()).optional().default([]),
});

export const ProcessKnowledgeRequestSchema = z.object({
  content: z.string().min(1, "Conteúdo da nota é obrigatório"),
  title: z.string().optional().default("Sem título"),
  sourceType: z.string().optional().default("document"),
  engineMode: z.enum(["local", "gemini", "openai"]).optional(),
  knowledgeSources: z.array(z.string()).optional().default([]),
});

export const ExtractTasksRequestSchema = z.object({
  content: z.string().min(1, "Conteúdo é obrigatório"),
  context: z.string().optional().default(""),
  engineMode: z.enum(["local", "gemini", "openai"]).optional(),
  knowledgeSources: z.array(z.string()).optional().default([]),
});

export const AnalyzeVaultRequestSchema = z.object({
  notes: z.array(
    z.object({
      id: z.string().optional(),
      path: z.string().optional(),
      title: z.string().optional(),
      folder: z.string().optional(),
      content: z.string().optional(),
      frontmatter: z.record(z.string(), z.unknown()).optional(),
    }).passthrough()
  ).optional().default([]),
  engineMode: z.enum(["local", "gemini", "openai"]).optional(),
  knowledgeSources: z.array(z.string()).optional().default([]),
});

export const SynthesizeLearningsRequestSchema = z.object({
  query: z.string().optional().default("aprendizados e regras estratégicas"),
  preferredPaths: z.array(z.string()).optional().default([]),
  engineMode: z.enum(["local", "gemini", "openai"]).optional(),
  knowledgeSources: z.array(z.string()).optional().default([]),
});

export const TestAIConnectionRequestSchema = z.object({
  provider: z.enum(["gemini", "openai"]).optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
});

// -------------------------------------------------------------
// Obsidian Proxy & Connection Schemas
// -------------------------------------------------------------

export const ObsidianTestConnectionRequestSchema = z.object({
  endpoint: z.string().optional().default("http://127.0.0.1:27124"),
  apiKey: z.string().min(1, "Token do Obsidian não informado"),
});

export const ObsidianProxyRequestSchema = z.object({
  endpoint: z.string().optional().default("http://127.0.0.1:27124"),
  apiKey: z.string().min(1, "Token do Obsidian não informado"),
  method: z.string().optional().default("GET"),
  path: z.string().optional().default("/"),
  body: z.unknown().optional(),
  headers: z.record(z.string(), z.unknown()).optional().default({}),
});

// -------------------------------------------------------------
// IPC Contract Schemas
// -------------------------------------------------------------

export const KnowledgeCommitPayloadSchema = z.object({
  folder: z.string().min(1, "Folder é obrigatório"),
  title: z.string().min(1, "Title é obrigatório"),
  content: z.string(),
  frontmatter: z.record(z.string(), z.unknown()).optional(),
  updateExisting: z.boolean().optional(),
  targetPath: z.string().optional(),
});

export const NoteWritePayloadSchema = z.object({
  folder: z.string().min(1, "Folder é obrigatório"),
  title: z.string().min(1, "Title é obrigatório"),
  content: z.string(),
  frontmatter: z.record(z.string(), z.unknown()).optional(),
});

export const NoteAppendPayloadSchema = z.object({
  folder: z.string().min(1, "Folder é obrigatório"),
  title: z.string().min(1, "Title é obrigatório"),
  contentToAppend: z.string(),
});

export const NoteUpsertSectionPayloadSchema = z.object({
  folder: z.string().min(1, "Folder é obrigatório"),
  title: z.string().min(1, "Title é obrigatório"),
  sectionId: z.string().min(1),
  heading: z.string().min(1),
  content: z.string(),
});

export const NoteDeletePayloadSchema = z.object({
  folder: z.string().min(1, "Folder é obrigatório"),
  title: z.string().min(1, "Title é obrigatório"),
});

export const EditorialUpsertPayloadSchema = z.object({
  id: z.string().min(1, "ID é obrigatório"),
  title: z.string().min(1, "Title é obrigatório"),
  status: z.string().optional(),
  date: z.string().optional(),
  channel: z.string().optional(),
  format: z.string().optional(),
}).passthrough();
