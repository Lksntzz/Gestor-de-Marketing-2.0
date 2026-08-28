export type EngineMode = "local" | "gemini" | "ai";

export type KnowledgeStatus = "NOVO" | "EM REVISÃO" | "OFICIAL";

export interface Frontmatter {
  id?: string;
  tipo?: string;
  status?: KnowledgeStatus | string;
  owner?: string;
  created_at?: string;
  updated_at?: string;
  validade?: string;
  confidencialidade?: "Público" | "Interno" | "Confidencial" | string;
  produto?: string;
  nicho?: string;
  canal?: string;
  projeto?: string;
  tags?: string[];
  origem?: string;
  source_url?: string;
  approved_by?: string;
  hash?: string;
  title?: string;
  aliases?: string[];
  category?: string;
  target_audience?: string;
  publish_date?: string;
  tone?: string;
  author?: string;
  last_reviewed?: string;
  [key: string]: any;
}

export interface ObsidianNote {
  id: string;
  path: string;
  title: string;
  folder: string;
  content: string;
  frontmatter: Frontmatter;
  tags: string[];
  wikilinks: string[];
  lastModified: string;
  sizeBytes?: number;
  syncedWithApi?: boolean;
}

export interface MarketingChannelContent {
  channel: string;
  title: string;
  copy: string;
  callToAction: string;
  hashtagsOrKeywords: string[];
  suggestedPublishDate?: string;
  mediaType?: "carousel" | "single_image" | "video_script" | "text_thread" | "email";
}

export interface MarketingCampaign {
  id: string;
  title: string;
  objective: string;
  targetAudience: string;
  tone: string;
  status: "draft" | "scheduled" | "active" | "completed";
  channels: string[];
  channelsContent: MarketingChannelContent[];
  linkedNotePaths: string[];
  obsidianOutputNotePath?: string;
  summary: string;
  strategy: string;
  startDate: string;
  endDate: string;
  createdDate: string;
}

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in-progress" | "done";

export interface MarketingTask {
  id: string;
  title: string;
  description?: string;
  channel?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  dueTime?: string;
  reminderDate?: string;
  reminderTime?: string;
  obsidianTaskString: string;
  obsidianFilePath?: string;
  linkedCampaignId?: string;
  tags: string[];
  isReminderActive: boolean;
  completedAt?: string;
}

export interface MarketingReminder {
  id: string;
  taskId: string;
  taskTitle: string;
  channel?: string;
  triggerDate: string;
  triggerTime: string;
  status: "pending" | "triggered" | "dismissed";
  obsidianReminderString: string;
  obsidianFilePath?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: "on_campaign_created" | "daily_schedule" | "on_note_tagged" | "reminder_triggered";
  conditionParam?: string;
  action: "create_tasks_in_daily_note" | "schedule_reminders" | "push_to_obsidian_api" | "generate_status_report";
  enabled: boolean;
  lastRun?: string;
  executionCount: number;
}

export interface ObsidianApiConfig {
  endpoint: string;
  apiKey: string;
  aiProvider?: "gemini" | "openai";
  aiModel?: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  vaultName: string;
  useHttps: boolean;
  autoSync: boolean;
  syncIntervalSeconds: number;
  connectionStatus: "connected" | "disconnected" | "error" | "testing";
  lastSyncTime?: string;
  errorMessage?: string;
  allowSelfSignedCerts: boolean;
}

export interface IdeaItem {
  id: string;
  title: string;
  category: "campanha" | "artigo" | "video" | "redes" | "lead-magnet" | "growth";
  impact: "alto" | "medio" | "estrategico";
  status: "ideia" | "em-producao" | "validado" | "arquivado";
  targetPersona: string;
  hook: string;
  sourceNoteTitle?: string;
  tags: string[];
  estimatedReach?: string;
}

export interface CreativeScript {
  id: string;
  title: string;
  type: "video_reels" | "video_youtube" | "podcast_intro" | "carrossel_slide" | "email_story";
  durationOrSlides: string;
  objective: string;
  targetAudience: string;
  hookScene: string;
  bodyScenes: Array<{
    step: string;
    visualCues: string;
    audioOrNarration: string;
  }>;
  callToAction: string;
  tags: string[];
}

export interface VisualAsset {
  id: string;
  title: string;
  channel: string;
  format: "1:1 Feed" | "9:16 Story/Reels" | "16:9 Banner/YouTube" | "Carrossel 4:5";
  aspectRatio: string;
  promptVisual: string;
  headlineOverlay: string;
  colorPalette: string[];
  imageUrl?: string;
  tags: string[];
}

export interface VaultAuditInsight {
  readinessScore: number;
  scoreAnalysis: string;
  knowledgeGaps: Array<{
    topic: string;
    recommendation: string;
    urgency: "alta" | "media" | "baixa" | string;
  }>;
  suggestedCampaigns: Array<{
    title: string;
    rationale: string;
    recommendedChannels: string[];
    estimatedEffort?: string;
  }>;
  automatedWorkflowRecommendations: string[];
}

export type EmotionalDriverKey =
  | "curiosidade"
  | "fomo_medo"
  | "alivio_praticidade"
  | "ambicao_crescimento"
  | "frustracao_antigo"
  | "urgencia_acao"
  | "confianca_autoridade";

export interface EmotionalDriver {
  id: EmotionalDriverKey;
  name: string;
  emoji: string;
  tagline: string;
  colorClass: string;
  psychologicalTrigger: string;
  sampleHooks: string[];
  bestFormats: string[];
  historicalAvgCtr: string;
}

export type NicheSegmentKey =
  | "empreendedoras_papelaria"
  | "lideres_eclesiasticos"
  | "editoras_autores"
  | "empresas_corporativo"
  | "professores_educacao"
  | "tech_leads_devs"
  | "cmos_growth"
  | "creators_solopreneurs"
  | "consultores_agencias"
  | "saas_founders";

export interface NicheSegment {
  id: NicheSegmentKey;
  name: string;
  badge: string;
  colorClass: string;
  corePains: string[];
  primaryChannels: string[];
  toneOfVoice: string;
  conversionAvgRate: string;
}

export interface PostHistoryItem {
  id: string;
  title: string;
  channel: string;
  format: "carrossel" | "reels_video" | "artigo_blog" | "newsletter" | "thread_post";
  publishedAt: string;
  dayOfWeek: string;
  timeSlot: string;
  targetNiche: NicheSegmentKey;
  emotionalDriver: EmotionalDriverKey;
  hookUsed: string;
  metrics: {
    impressions: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    clicksOrLeads: number;
    ctrPercent: number;
    conversionRatePercent: number;
  };
  performanceScore: number;
  learnings: string;
  whatWorked: string[];
  whatToAvoid: string[];
  linkedObsidianNote?: string;
}

export interface LearningInsight {
  id: string;
  title: string;
  category: "formato" | "horario" | "nicho" | "emocao" | "copywriting";
  verdict: "VENCEDOR" | "ALTO_IMPACTO" | "A_EVITAR" | "EM_TESTE";
  ruleOfThumb: string;
  evidenceData: string;
  suggestedAction: string;
  recommendedFormat?: string;
  bestTimeSlot?: string;
  bestEmotion?: EmotionalDriverKey;
  bestNiche?: NicheSegmentKey;
  dateCreated: string;
}

export interface DailyRoutineSlot {
  id: string;
  dayOfWeek: "Segunda" | "Terça" | "Quarta" | "Quinta" | "Sexta" | "Sábado" | "Domingo";
  focusTheme: string;
  primaryEmotion: EmotionalDriverKey;
  primaryNiche: NicheSegmentKey;
  recommendedFormat: "carrossel" | "reels_video" | "artigo_blog" | "newsletter" | "thread_post";
  optimalTime: string;
  suggestedHookPattern: string;
  plannedAction: string;
  status: "planejando" | "em-producao" | "agendado" | "publicado";
  linkedScriptId?: string;
  linkedPostId?: string;
}

type ElectronWriteResult = Promise<{ success: boolean; path?: string; error?: string }>;

type KnowledgeCommitResult = Promise<{
  success: boolean;
  error?: string;
  noteTitle?: string;
  noteRelativePath?: string;
  assetRelativePath?: string;
  assetFileName?: string;
  assetMtimeMs?: number;
  assetSize?: number;
}>;

declare global {
  interface Window {
    electronAPI?: {
      isElectron: () => boolean;
      selectVault: () => Promise<{ vaultPath: string; foldersCreated: string[] } | null>;
      getVaultPath: () => Promise<string | null>;
      setObsidianConnectionState: (connected: boolean) => Promise<{ success: boolean; connected: boolean }>;
      listVaultFolders: () => Promise<string[]>;
      readNotes: () => Promise<any[]>;
      commitKnowledge: (payload: {
        folder: string;
        title: string;
        content: string;
        frontmatter?: Record<string, unknown>;
        asset?: { fileName: string; dataUrl: string };
      }) => KnowledgeCommitResult;
      writeNote: {
        (folder: string, title: string, content: string, frontmatter?: any): ElectronWriteResult;
        (legacyVaultPath: string, folder: string, title: string, content: string, frontmatter?: any): ElectronWriteResult;
      };
      appendNote: (folder: string, title: string, contentToAppend: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      upsertNoteSection: (folder: string, title: string, sectionId: string, heading: string, content: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      deleteNote: (folder: string, title: string) => Promise<{ success: boolean; error?: string }>;
      setSecret: (name: string, value: string) => Promise<{ success: boolean }>;
      getSecret: (name: string) => Promise<string>;
      deleteSecret: (name: string) => Promise<{ success: boolean }>;
      setAIConfig: (config: { provider: "gemini" | "openai"; model?: string }) => Promise<{ success: boolean }>;
      getSystemStatus: () => Promise<any>;
    };
  }
}
