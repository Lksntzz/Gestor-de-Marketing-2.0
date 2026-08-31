import { z } from "zod";
import { PersistedAIConnectionSchema } from "./aiConnection";

const StringArray = z.array(z.string());
const FrontmatterSchema = z.record(z.string(), z.unknown());

export const PersistedObsidianNoteSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  title: z.string().min(1),
  folder: z.string().min(1),
  content: z.string(),
  frontmatter: FrontmatterSchema,
  tags: StringArray,
  wikilinks: StringArray,
  lastModified: z.string(),
  sizeBytes: z.number().optional(),
  syncedWithApi: z.boolean().optional(),
}).passthrough();

export const PersistedCampaignSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  objective: z.string(),
  targetAudience: z.string(),
  tone: z.string(),
  status: z.enum(["draft", "scheduled", "active", "completed"]),
  channels: StringArray,
  channelsContent: z.array(z.object({
    channel: z.string(),
    title: z.string(),
    copy: z.string(),
    callToAction: z.string(),
    hashtagsOrKeywords: StringArray,
    suggestedPublishDate: z.string().optional(),
    mediaType: z.enum(["carousel", "single_image", "video_script", "text_thread", "email"]).optional(),
  }).passthrough()),
  linkedNotePaths: StringArray,
  obsidianOutputNotePath: z.string().optional(),
  summary: z.string(),
  strategy: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  createdDate: z.string(),
}).passthrough();

export const PersistedMarketingTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  channel: z.string().optional(),
  priority: z.enum(["unspecified", "low", "medium", "high", "urgent"]),
  status: z.enum(["todo", "in-progress", "done"]),
  dueDate: z.string(),
  dueTime: z.string().optional(),
  reminderDate: z.string().optional(),
  reminderTime: z.string().optional(),
  obsidianTaskString: z.string(),
  obsidianFilePath: z.string().optional(),
  linkedCampaignId: z.string().optional(),
  tags: StringArray,
  isReminderActive: z.boolean(),
  completedAt: z.string().optional(),
}).passthrough();

export const PersistedAutomationRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  trigger: z.enum(["on_campaign_created", "daily_schedule", "on_note_tagged", "reminder_triggered"]),
  conditionParam: z.string().optional(),
  action: z.enum(["create_tasks_in_daily_note", "schedule_reminders", "push_to_obsidian_api", "generate_status_report"]),
  enabled: z.boolean(),
  lastRun: z.string().optional(),
  executionCount: z.number().int().nonnegative(),
}).passthrough();

export const PersistedIdeaSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.enum(["campanha", "artigo", "video", "redes", "lead-magnet", "growth"]).optional(),
  impact: z.enum(["alto", "medio", "estrategico"]).optional(),
  status: z.enum(["ideia", "em-producao", "validado", "arquivado"]),
  targetPersona: z.string(),
  hook: z.string(),
  sourceNoteTitle: z.string().optional(),
  tags: StringArray,
  estimatedReach: z.string().optional(),
  format: z.string().optional(),
  channel: z.string().optional(),
  objective: z.string().optional(),
  concept: z.string().optional(),
  keyMessage: z.string().optional(),
  callToAction: z.string().optional(),
  suggestedVisual: z.string().optional(),
  rationale: z.string().optional(),
}).passthrough();

export const PersistedScriptSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(["video_reels", "video_youtube", "podcast_intro", "carrossel_slide", "email_story"]),
  durationOrSlides: z.string(),
  objective: z.string(),
  targetAudience: z.string(),
  hookScene: z.string(),
  bodyScenes: z.array(z.object({
    step: z.string(),
    visualCues: z.string(),
    audioOrNarration: z.string(),
  })),
  callToAction: z.string(),
  tags: StringArray,
  platform: z.string().optional(),
  format: z.string().optional(),
  sourceIdeaId: z.string().optional(),
  sourceIdeaTitle: z.string().optional(),
}).passthrough();

export const PersistedVisualSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  channel: z.string(),
  format: z.enum(["1:1 Feed", "9:16 Story/Reels", "16:9 Banner/YouTube", "Carrossel 4:5"]),
  aspectRatio: z.string(),
  promptVisual: z.string(),
  headlineOverlay: z.string(),
  colorPalette: StringArray,
  imageUrl: z.string().optional(),
  tags: StringArray,
}).passthrough();

export const PersistedEmotionalDriverSchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
  tagline: z.string(),
  colorClass: z.string(),
  psychologicalTrigger: z.string(),
  sampleHooks: StringArray,
  bestFormats: StringArray,
  historicalAvgCtr: z.string(),
}).passthrough();

export const PersistedNicheSchema = z.object({
  id: z.string(),
  name: z.string(),
  badge: z.string(),
  colorClass: z.string(),
  corePains: StringArray,
  primaryChannels: StringArray,
  toneOfVoice: z.string(),
  conversionAvgRate: z.string(),
}).passthrough();

/**
 * Result persistence accepts both the legacy rich shape and the sparse V1
 * evidence shape. Optional metrics remain absent when they were not measured.
 */
export const PersistedPostHistorySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  channel: z.string().min(1),
  format: z.string().min(1),
  publishedAt: z.string().min(1),
  dayOfWeek: z.string().optional(),
  timeSlot: z.string().optional(),
  targetNiche: z.string().optional(),
  emotionalDriver: z.string().optional(),
  hookUsed: z.string().optional(),
  metrics: z.object({
    impressions: z.number().nonnegative().optional(),
    reach: z.number().nonnegative().optional(),
    likes: z.number().nonnegative().optional(),
    comments: z.number().nonnegative().optional(),
    shares: z.number().nonnegative().optional(),
    saves: z.number().nonnegative().optional(),
    clicksOrLeads: z.number().nonnegative().optional(),
    ctrPercent: z.number().nonnegative().optional(),
    conversionRatePercent: z.number().nonnegative().optional(),
  }).optional(),
  performanceScore: z.number().optional(),
  learnings: z.string().optional(),
  whatWorked: StringArray.optional(),
  whatToAvoid: StringArray.optional(),
  linkedObsidianNote: z.string().optional(),
  editorialItemId: z.string().optional(),
  linkedCampaignId: z.string().optional(),
  evidenceSource: z.string().optional(),
}).passthrough();

export const PersistedLearningSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  category: z.enum(["formato", "horario", "nicho", "emocao", "copywriting", "canal", "oferta", "audiência"]),
  verdict: z.enum(["VENCEDOR", "ALTO_IMPACTO", "A_EVITAR", "EM_TESTE", "CONFIRMADO", "REFUTADO"]),
  ruleOfThumb: z.string(),
  evidenceData: z.string(),
  suggestedAction: z.string(),
  recommendedFormat: z.string().optional(),
  bestTimeSlot: z.string().optional(),
  bestEmotion: z.string().optional(),
  bestNiche: z.string().optional(),
  dateCreated: z.string(),
}).passthrough();

export const PersistedRoutineSlotSchema = z.object({
  id: z.string().min(1),
  dayOfWeek: z.enum(["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]),
  focusTheme: z.string(),
  primaryEmotion: z.string(),
  primaryNiche: z.string(),
  recommendedFormat: z.enum(["carrossel", "reels_video", "artigo_blog", "newsletter", "thread_post"]),
  optimalTime: z.string(),
  suggestedHookPattern: z.string(),
  plannedAction: z.string(),
  status: z.enum(["planejando", "em-producao", "agendado", "publicado"]),
  linkedScriptId: z.string().optional(),
  linkedPostId: z.string().optional(),
}).passthrough();

export const PersistedEditorialItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  contentType: z.string(),
  platform: z.string(),
  objective: z.string(),
  scheduledDate: z.string(),
  scheduledTime: z.string().optional(),
  status: z.enum(["DRAFT", "IN_PRODUCTION", "REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED", "ARCHIVED"]),
  priority: z.enum(["unspecified", "low", "medium", "high", "urgent"]),
  ideaId: z.string().optional(),
  scriptId: z.string().optional(),
  campaignId: z.string().optional(),
  obsidianPath: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
}).passthrough();

export const AppStateSchemas = {
  engineMode: z.enum(["local", "gemini", "ai"]),
  notes: z.array(PersistedObsidianNoteSchema),
  campaigns: z.array(PersistedCampaignSchema),
  tasks: z.array(PersistedMarketingTaskSchema),
  automationRules: z.array(PersistedAutomationRuleSchema),
  ideas: z.array(PersistedIdeaSchema),
  scripts: z.array(PersistedScriptSchema),
  visuals: z.array(PersistedVisualSchema),
  emotionalDrivers: z.array(PersistedEmotionalDriverSchema),
  niches: z.array(PersistedNicheSchema),
  postHistory: z.array(PersistedPostHistorySchema),
  learnings: z.array(PersistedLearningSchema),
  weeklyRoutine: z.array(PersistedRoutineSlotSchema),
  editorialItems: z.array(PersistedEditorialItemSchema),
  firedReminderKeys: z.array(z.string()),
};

const ImportedApiConfigSchema = z.object({
  endpoint: z.string().optional(),
  vaultName: z.string().optional(),
  useHttps: z.boolean().optional(),
  autoSync: z.boolean().optional(),
  syncIntervalSeconds: z.number().optional(),
  connectionStatus: z.enum(["connected", "disconnected", "error", "testing"]).optional(),
  lastSyncTime: z.string().optional(),
  errorMessage: z.string().optional(),
  allowSelfSignedCerts: z.boolean().optional(),
  aiProvider: z.enum(["gemini", "openai"]).optional(),
  aiModel: z.string().optional(),
  aiConnection: PersistedAIConnectionSchema.optional(),
  apiKey: z.unknown().optional(),
  geminiApiKey: z.unknown().optional(),
  openaiApiKey: z.unknown().optional(),
}).strip();

export const WorkspaceImportSchema = z.object({
  formatVersion: z.union([z.literal(1), z.literal(2)]).optional(),
  version: z.string().optional(),
  exportedAt: z.string().optional(),
  notes: AppStateSchemas.notes,
  campaigns: AppStateSchemas.campaigns,
  tasks: AppStateSchemas.tasks,
  automationRules: AppStateSchemas.automationRules.optional(),
  ideas: AppStateSchemas.ideas.optional(),
  scripts: AppStateSchemas.scripts.optional(),
  visuals: AppStateSchemas.visuals.optional(),
  emotionalDrivers: AppStateSchemas.emotionalDrivers.optional(),
  niches: AppStateSchemas.niches.optional(),
  postHistory: AppStateSchemas.postHistory.optional(),
  learnings: AppStateSchemas.learnings.optional(),
  weeklyRoutine: AppStateSchemas.weeklyRoutine.optional(),
  engineMode: AppStateSchemas.engineMode.optional(),
  editorialItems: AppStateSchemas.editorialItems.optional(),
  apiConfig: ImportedApiConfigSchema.optional(),
}).strip();

export type WorkspaceImport = z.infer<typeof WorkspaceImportSchema>;

export type WorkspaceBackupInput = {
  version: string;
  exportedAt?: string;
  notes: z.input<typeof AppStateSchemas.notes>;
  campaigns: z.input<typeof AppStateSchemas.campaigns>;
  tasks: z.input<typeof AppStateSchemas.tasks>;
  automationRules: z.input<typeof AppStateSchemas.automationRules>;
  ideas: z.input<typeof AppStateSchemas.ideas>;
  scripts: z.input<typeof AppStateSchemas.scripts>;
  visuals: z.input<typeof AppStateSchemas.visuals>;
  emotionalDrivers: z.input<typeof AppStateSchemas.emotionalDrivers>;
  niches: z.input<typeof AppStateSchemas.niches>;
  postHistory: z.input<typeof AppStateSchemas.postHistory>;
  learnings: z.input<typeof AppStateSchemas.learnings>;
  weeklyRoutine: z.input<typeof AppStateSchemas.weeklyRoutine>;
  engineMode: z.input<typeof AppStateSchemas.engineMode>;
  editorialItems: z.input<typeof AppStateSchemas.editorialItems>;
  apiConfig?: z.input<typeof ImportedApiConfigSchema>;
};

export function parseWorkspaceImport(input: unknown): WorkspaceImport {
  const parsed = WorkspaceImportSchema.parse(input);
  if (parsed.apiConfig) {
    delete (parsed.apiConfig as Record<string, unknown>).apiKey;
    delete (parsed.apiConfig as Record<string, unknown>).geminiApiKey;
    delete (parsed.apiConfig as Record<string, unknown>).openaiApiKey;
    parsed.apiConfig.connectionStatus = "disconnected";
    delete parsed.apiConfig.errorMessage;
  }
  return parsed;
}

export function buildWorkspaceBackup(input: WorkspaceBackupInput): WorkspaceImport {
  return parseWorkspaceImport({
    ...input,
    formatVersion: 2,
    exportedAt: input.exportedAt || new Date().toISOString(),
  });
}
