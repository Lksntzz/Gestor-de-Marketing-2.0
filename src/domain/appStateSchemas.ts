import { z } from "zod";

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
  priority: z.enum(["low", "medium", "high", "urgent"]),
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
  category: z.enum(["campanha", "artigo", "video", "redes", "lead-magnet", "growth"]),
  impact: z.enum(["alto", "medio", "estrategico"]),
  status: z.enum(["ideia", "em-producao", "validado", "arquivado"]),
  targetPersona: z.string(),
  hook: z.string(),
  sourceNoteTitle: z.string().optional(),
  tags: StringArray,
  estimatedReach: z.string().optional(),
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

export const PersistedPostHistorySchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  channel: z.string(),
  format: z.enum(["carrossel", "reels_video", "artigo_blog", "newsletter", "thread_post"]),
  publishedAt: z.string(),
  dayOfWeek: z.string(),
  timeSlot: z.string(),
  targetNiche: z.string(),
  emotionalDriver: z.string(),
  hookUsed: z.string(),
  metrics: z.object({
    impressions: z.number(),
    reach: z.number(),
    likes: z.number(),
    comments: z.number(),
    shares: z.number(),
    saves: z.number(),
    clicksOrLeads: z.number(),
    ctrPercent: z.number(),
    conversionRatePercent: z.number(),
  }),
  performanceScore: z.number(),
  learnings: z.string(),
  whatWorked: StringArray,
  whatToAvoid: StringArray,
  linkedObsidianNote: z.string().optional(),
}).passthrough();

export const PersistedLearningSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  category: z.enum(["formato", "horario", "nicho", "emocao", "copywriting"]),
  verdict: z.enum(["VENCEDOR", "ALTO_IMPACTO", "A_EVITAR", "EM_TESTE"]),
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
  apiKey: z.unknown().optional(),
  geminiApiKey: z.unknown().optional(),
  openaiApiKey: z.unknown().optional(),
}).strip();

export const WorkspaceImportSchema = z.object({
  version: z.string().optional(),
  notes: AppStateSchemas.notes,
  campaigns: AppStateSchemas.campaigns,
  tasks: AppStateSchemas.tasks,
  apiConfig: ImportedApiConfigSchema.optional(),
}).strip();

export type WorkspaceImport = z.infer<typeof WorkspaceImportSchema>;

export function parseWorkspaceImport(input: unknown): WorkspaceImport {
  const parsed = WorkspaceImportSchema.parse(input);
  if (parsed.apiConfig && "apiKey" in parsed.apiConfig) {
    delete (parsed.apiConfig as Record<string, unknown>).apiKey;
  }
  if (parsed.apiConfig) {
    delete (parsed.apiConfig as Record<string, unknown>).geminiApiKey;
    delete (parsed.apiConfig as Record<string, unknown>).openaiApiKey;
  }
  return parsed;
}
