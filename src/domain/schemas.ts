import { z } from "zod";
import { OFFICIAL_TAXONOMY_FOLDERS } from "./taxonomy";

// ==========================================
// 1. KNOWLEDGE STATUS & YAML FRONTMATTER
// ==========================================

export const KnowledgeStatusEnum = z.enum(["OFICIAL", "EM REVISÃO", "NOVO"]);
export type KnowledgeStatus = z.infer<typeof KnowledgeStatusEnum>;

export const NoteFrontmatterSchema = z.object({
  id: z.string().min(1),
  tipo: z.string().default("Documento PKM"),
  status: KnowledgeStatusEnum.default("NOVO"),
  owner: z.string().default("Gestor de Marketing Nisti Print"),
  created_at: z.string(),
  updated_at: z.string(),
  validade: z.string().optional(),
  confidencialidade: z.enum(["Público", "Interno", "Confidencial"]).default("Interno"),
  produto: z.string().default("Linha Nisti Print"),
  nicho: z.string().default("Papelaria Criativa & B2B"),
  canal: z.string().default("Omnichannel"),
  projeto: z.string().default("Geral"),
  tags: z.array(z.string()).default([]),
  origem: z.string().default("Central de Conhecimento"),
  approved_by: z.string().optional().default(""),
  hash: z.string().min(1),
  aliases: z.array(z.string()).optional(),
  title: z.string().optional(),
});
export type NoteFrontmatter = z.infer<typeof NoteFrontmatterSchema>;

// ==========================================
// 2. KNOWLEDGE NOTE (OBSIDIAN ATOMIC NOTE)
// ==========================================

export const KnowledgeNoteSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  title: z.string().min(1),
  folder: z.enum(OFFICIAL_TAXONOMY_FOLDERS),
  content: z.string(),
  tags: z.array(z.string()).default([]),
  wikilinks: z.array(z.string()).default([]),
  frontmatter: NoteFrontmatterSchema,
  lastModified: z.string(),
  syncedWithApi: z.boolean().default(false),
  isDemoData: z.boolean().default(false),
});
export type KnowledgeNote = z.infer<typeof KnowledgeNoteSchema>;

// ==========================================
// 3. PROJECT / CAMPAIGN
// ==========================================

export const ProjectStatusEnum = z.enum([
  "planejamento",
  "em-revisao",
  "aprovado",
  "ativo",
  "pausado",
  "concluido"
]);
export type ProjectStatus = z.infer<typeof ProjectStatusEnum>;

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  objective: z.string(),
  status: ProjectStatusEnum.default("planejamento"),
  targetAudience: z.string(),
  targetTone: z.string(),
  channels: z.array(z.string()),
  notesLinked: z.array(z.string()).default([]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.number().optional().default(0),
  hash: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  approvedBy: z.string().optional(),
  isDemoData: z.boolean().default(false),
});
export type Project = z.infer<typeof ProjectSchema>;

// ==========================================
// 4. TASK (OBSIDIAN TASKS COMPATIBLE)
// ==========================================

export const TaskPriorityEnum = z.enum(["urgent", "high", "medium", "low"]);
export type TaskPriority = z.infer<typeof TaskPriorityEnum>;

export const TaskStatusEnum = z.enum(["todo", "in-progress", "done", "cancelled"]);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

export const TaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: TaskStatusEnum.default("todo"),
  priority: TaskPriorityEnum.default("medium"),
  dueDate: z.string(),
  dueTime: z.string().optional(),
  channel: z.string().default("Geral"),
  obsidianTaskString: z.string(),
  reminderDate: z.string().optional(),
  reminderTime: z.string().optional(),
  category: z.string().default("Planejamento"),
  projectId: z.string().optional(),
  sourceNoteTitle: z.string().optional(),
  sourceNotePath: z.string().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
  hash: z.string().min(1),
  isDemoData: z.boolean().default(false),
});
export type Task = z.infer<typeof TaskSchema>;

// ==========================================
// 5. CONTENT (CREATIVE PIECE / SCRIPT)
// ==========================================

export const ContentTypeEnum = z.enum([
  "social_post",
  "video_reels",
  "carrossel",
  "email_newsletter",
  "artigo_seo",
  "lead_magnet"
]);
export type ContentType = z.infer<typeof ContentTypeEnum>;

export const ContentStatusEnum = z.enum(["ideia", "rascunho", "em-revisao", "aprovado", "agendado", "publicado"]);
export type ContentStatus = z.infer<typeof ContentStatusEnum>;

export const ContentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: ContentTypeEnum,
  status: ContentStatusEnum.default("rascunho"),
  channel: z.string(),
  objective: z.string().optional(),
  targetAudience: z.string().optional(),
  hook: z.string().optional(),
  bodyCopy: z.string(),
  callToAction: z.string(),
  hashtags: z.array(z.string()).default([]),
  projectId: z.string().optional(),
  scheduledDate: z.string().optional(),
  approvedBy: z.string().optional(),
  hash: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  isDemoData: z.boolean().default(false),
});
export type Content = z.infer<typeof ContentSchema>;

// ==========================================
// 6. PUBLICATION
// ==========================================

export const PublicationStatusEnum = z.enum(["scheduled", "publishing", "published", "failed"]);
export type PublicationStatus = z.infer<typeof PublicationStatusEnum>;

export const PublicationSchema = z.object({
  id: z.string().min(1),
  contentId: z.string().min(1),
  channel: z.string(),
  status: PublicationStatusEnum.default("scheduled"),
  scheduledAt: z.string(),
  publishedAt: z.string().optional(),
  externalUrl: z.string().url().optional(),
  externalPostId: z.string().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string(),
  isDemoData: z.boolean().default(false),
});
export type Publication = z.infer<typeof PublicationSchema>;

// ==========================================
// 7. METRIC
// ==========================================

export const MetricSchema = z.object({
  id: z.string().min(1),
  entityType: z.enum(["project", "content", "publication", "channel", "vault"]),
  entityId: z.string().min(1),
  metricKey: z.string().min(1),
  value: z.number(),
  unit: z.string().default("count"),
  measuredAt: z.string(),
  source: z.enum(["analytics", "user_input", "simulated", "system"]),
  isSimulated: z.boolean().default(false),
});
export type Metric = z.infer<typeof MetricSchema>;

// ==========================================
// 8. APPROVAL (AUDITED HUMAN SIGN-OFF)
// ==========================================

export const ApprovalSchema = z.object({
  id: z.string().min(1),
  entityType: z.enum(["note", "project", "task", "content", "automation"]),
  entityId: z.string().min(1),
  status: z.enum(["approved", "rejected", "pending"]),
  approverName: z.string().min(1),
  approverEmail: z.string().email().optional(),
  timestamp: z.string(),
  comments: z.string().optional(),
  hash: z.string().min(1),
});
export type Approval = z.infer<typeof ApprovalSchema>;

// ==========================================
// 9. AI RUN (AUDITED EXECUTION LOG)
// ==========================================

export const AIRunSchema = z.object({
  id: z.string().min(1),
  actionType: z.enum(["generate_campaign", "extract_tasks", "process_knowledge", "analyze_vault", "write_daily_note"]),
  engineMode: z.enum(["local", "ai"]),
  promptHash: z.string().min(1),
  modelUsed: z.string(),
  durationMs: z.number(),
  status: z.enum(["success", "fallback", "error"]),
  errorMessage: z.string().optional(),
  timestamp: z.string(),
});
export type AIRun = z.infer<typeof AIRunSchema>;

// ==========================================
// 10. AUDIT ENTRY
// ==========================================

export const AuditActionEnum = z.enum([
  "NOTE_CREATED",
  "NOTE_UPDATED",
  "NOTE_DELETED",
  "NOTE_STATUS_CHANGED",
  "TASK_CREATED",
  "TASK_UPDATED",
  "TASK_COMPLETED",
  "CAMPAIGN_CREATED",
  "CAMPAIGN_APPROVED",
  "CONTENT_PUBLISHED",
  "AUTOMATION_TRIGGERED",
  "DAILY_NOTE_APPENDED",
  "VAULT_SYNCED"
]);
export type AuditAction = z.infer<typeof AuditActionEnum>;

export const AuditEntrySchema = z.object({
  id: z.string().min(1),
  action: AuditActionEnum,
  entityId: z.string().min(1),
  entityType: z.string(),
  details: z.string(),
  actor: z.string().default("Gestor Nisti"),
  timestamp: z.string(),
  previousStateHash: z.string().optional(),
  newStateHash: z.string().optional(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

// ==========================================
// 11. AUTOMATION RULE
// ==========================================

export const AutomationRuleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  trigger: z.string().min(1),
  action: z.string().min(1),
  condition: z.string(),
  status: z.enum(["ativo", "pausado", "rascunho"]).default("ativo"),
  executionsCount: z.number().default(0),
  lastRun: z.string().optional(),
  isDemoData: z.boolean().default(false),
});
export type AutomationRule = z.infer<typeof AutomationRuleSchema>;
