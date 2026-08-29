import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Navbar } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";
import { DashboardView } from "./components/DashboardView";
import { VaultView } from "./components/VaultView";
import { CampaignsView } from "./components/CampaignsView";
import { TasksAutomationView } from "./components/TasksAutomationView";
import { RoutineIntelligenceView } from "./components/RoutineIntelligenceView";
import { EditorialCalendarView } from "./components/EditorialCalendarView";
import { AddKnowledgeView } from "./components/AddKnowledgeView";
import { ContentView } from "./components/ContentView";
import { ObsidianApiSettingsModal } from "./components/ObsidianApiSettingsModal";
import { ObsidianConnectionBlocker } from "./components/ObsidianConnectionBlocker";
import { TaskModal } from "./components/TaskModal";
import { NoteModal } from "./components/NoteModal";

import {
  ObsidianNote,
  MarketingCampaign,
  MarketingTask,
  AutomationRule,
  ObsidianApiConfig,
  VaultAuditInsight,
  EngineMode,
  IdeaItem,
  CreativeScript,
  VisualAsset,
  EmotionalDriver,
  NicheSegment,
  PostHistoryItem,
  LearningInsight,
  DailyRoutineSlot,
} from "./types";
import {
  DEFAULT_OBSIDIAN_NOTES,
  DEFAULT_CAMPAIGNS,
  DEFAULT_TASKS,
  DEFAULT_AUTOMATION_RULES,
  DEFAULT_IDEAS,
  DEFAULT_SCRIPTS,
  DEFAULT_VISUALS,
} from "./data/defaultVault";
import {
  DEFAULT_EMOTIONAL_DRIVERS,
  DEFAULT_NICHES,
  DEFAULT_POST_HISTORY,
  DEFAULT_LEARNING_INSIGHTS,
  DEFAULT_WEEKLY_ROUTINE,
} from "./data/routineData";
import { api, normalizeObsidianEndpoint } from "./services/api";
import { APP_STATE_KEYS, StorageManager } from "./services/storage/StorageManager";
import { usePersistentState, usePersistentTextState } from "./hooks/usePersistentState";
import { AppStateSchemas, parseWorkspaceImport } from "./domain/appStateSchemas";
import { formatToObsidianTask } from "./utils/obsidianUri";
import {
  PLANNING_SUBNAVIGATION,
  isPlanningSubnavigationView,
} from "./navigation/productNavigation";
import {
  generateLocalCampaign,
  extractLocalTasksFromNote,
  analyzeLocalVault,
} from "./utils/localEngine";
import {
  APP_VERSION,
  AUTOMATION_HIGH_PRIORITY_SECTION_ID,
  DAILY_TASKS_SECTION_ID,
  dateForRoutineDay,
  isReminderDue,
  localDateKey,
  mergeByPath,
  pruneFiredReminderKeys,
  reminderEventKey,
  stableRoutineTaskId,
  startOfWeekMonday,
  upsertItemsById,
  upsertManagedSection,
} from "./utils/reliability";
import confetti from "canvas-confetti";
import { Bell, CheckCircle2, Sparkles, Calendar } from "lucide-react";

const storage = StorageManager.getInstance();

function createDailyNote(today: string, content: string): ObsidianNote {
  return {
    id: `note-daily-${today}`,
    path: storage.getDailyNotePath(today),
    title: `Daily Note: ${today}`,
    folder: "00_Inbox",
    content,
    frontmatter: {
      id: `daily_${today}`,
      tipo: "Daily Note",
      status: "OFICIAL",
      owner: "Gestor de Marketing Nisti Print",
      created_at: today,
      updated_at: today,
      confidencialidade: "Interno",
      produto: "Todos",
      nicho: "Operações & Marketing",
      canal: "Omnichannel",
      projeto: "Rotina Diária",
      tags: ["daily-note", "marketing", "rotina"],
      origem: "App Nisti PKM",
      approved_by: "Gestor de Marketing",
      hash: `daily_${today}`,
    },
    tags: ["daily-note", "marketing", "rotina"],
    wikilinks: ["01_Estrategia/Brand Voice & Posicionamento Nisti Print"],
    lastModified: new Date().toISOString().replace("T", " ").slice(0, 16),
    syncedWithApi: false,
  };
}

const SubTabs = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: any) => void }) => {
  return (
    <div className="bg-[#0B0D1B] border-b border-white/5 px-8 flex gap-6 pt-3 shrink-0">
      {PLANNING_SUBNAVIGATION.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.id === "campaigns" ? Sparkles : Calendar;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
              isActive
                ? "border-pink-500 text-pink-500"
                : "border-transparent text-stone-400 hover:text-white"
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "vault" | "campaigns" | "tasks" | "automations" | "routine" | "knowledge" | "content" | "editorial"
  >("dashboard");

  const [engineMode, setEngineMode] = usePersistentTextState<EngineMode>(
    APP_STATE_KEYS.ENGINE_MODE,
    "local",
    AppStateSchemas.engineMode
  );

  const [notes, setNotes] = usePersistentState<ObsidianNote[]>(
    APP_STATE_KEYS.NOTES,
    DEFAULT_OBSIDIAN_NOTES,
    AppStateSchemas.notes
  );
  const [campaigns, setCampaigns] = usePersistentState<MarketingCampaign[]>(
    APP_STATE_KEYS.CAMPAIGNS,
    DEFAULT_CAMPAIGNS,
    AppStateSchemas.campaigns
  );
  const [tasks, setTasks] = usePersistentState<MarketingTask[]>(
    APP_STATE_KEYS.TASKS,
    DEFAULT_TASKS,
    AppStateSchemas.tasks
  );
  const [automationRules, setAutomationRules] = usePersistentState<AutomationRule[]>(
    APP_STATE_KEYS.AUTOMATION_RULES,
    DEFAULT_AUTOMATION_RULES,
    AppStateSchemas.automationRules
  );
  const [ideas, setIdeas] = usePersistentState<IdeaItem[]>(
    APP_STATE_KEYS.IDEAS,
    DEFAULT_IDEAS,
    AppStateSchemas.ideas
  );
  const [scripts, setScripts] = usePersistentState<CreativeScript[]>(
    APP_STATE_KEYS.SCRIPTS,
    DEFAULT_SCRIPTS,
    AppStateSchemas.scripts
  );
  const [visuals, setVisuals] = usePersistentState<VisualAsset[]>(
    APP_STATE_KEYS.VISUALS,
    DEFAULT_VISUALS,
    AppStateSchemas.visuals
  );
  const [emotionalDrivers, setEmotionalDrivers] = usePersistentState<EmotionalDriver[]>(
    APP_STATE_KEYS.EMOTIONAL_DRIVERS,
    DEFAULT_EMOTIONAL_DRIVERS,
    AppStateSchemas.emotionalDrivers
  );
  const [niches, setNiches] = usePersistentState<NicheSegment[]>(
    APP_STATE_KEYS.NICHES,
    DEFAULT_NICHES,
    AppStateSchemas.niches
  );
  const [postHistory, setPostHistory] = usePersistentState<PostHistoryItem[]>(
    APP_STATE_KEYS.POST_HISTORY,
    DEFAULT_POST_HISTORY,
    AppStateSchemas.postHistory
  );
  const [learnings, setLearnings] = usePersistentState<LearningInsight[]>(
    APP_STATE_KEYS.LEARNINGS,
    DEFAULT_LEARNING_INSIGHTS,
    AppStateSchemas.learnings
  );
  const [weeklyRoutine, setWeeklyRoutine] = usePersistentState<DailyRoutineSlot[]>(
    APP_STATE_KEYS.WEEKLY_ROUTINE,
    DEFAULT_WEEKLY_ROUTINE,
    AppStateSchemas.weeklyRoutine
  );

  const [apiConfig, setApiConfig] = useState<ObsidianApiConfig>({
    endpoint: "https://127.0.0.1:27124",
    apiKey: "",
    geminiApiKey: "",
    openaiApiKey: "",
    aiProvider: "gemini",
    aiModel: "",
    vaultName: "MarketingVault",
    useHttps: true,
    autoSync: true,
    syncIntervalSeconds: 60,
    connectionStatus: "disconnected",
    allowSelfSignedCerts: true,
  });

  const updateAndSaveApiConfig = useCallback((update: ObsidianApiConfig | ((prev: ObsidianApiConfig) => ObsidianApiConfig)) => {
    setApiConfig((prev) => {
      const next = typeof update === "function" ? update(prev) : update;

      setTimeout(() => {
        void storage.saveApiConfig(next);
        if (next.connectionStatus !== "connected" || !next.apiKey?.trim() || !next.endpoint?.trim()) {
          api.disconnectObsidianSession("Configuração do Obsidian revogada ou inválida.");
        }
      }, 0);

      return next;
    });
  }, []);

  useEffect(() => {
    storage
      .loadApiConfig(apiConfig)
      .then(async (loaded) => {
        if (loaded) {
          if (window.electronAPI || (loaded.endpoint?.trim() && loaded.apiKey?.trim())) {
            try {
              const res = await api.probeObsidianConnection(loaded);
              if (res.success) {
                const connectedConfig: ObsidianApiConfig = {
                  ...loaded,
                  connectionStatus: "connected",
                  errorMessage: undefined,
                  vaultName: res.detectedVaultName || loaded.vaultName || "MarketingVault",
                };
                setApiConfig(connectedConfig);
                return;
              }
            } catch (err) {
              console.warn("Auto-reconnection to Obsidian on startup failed:", err);
            }
          }
          setApiConfig({
            ...loaded,
            connectionStatus: "disconnected",
          });
          api.disconnectObsidianSession("Sessão inicializada como desconectada.");
        }
      });
  }, []);

  const [selectedNote, setSelectedNote] = useState<ObsidianNote | null>(notes[0] || null);
  const [auditInsight, setAuditInsight] = useState<VaultAuditInsight | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  const [isGeneratingCampaign, setIsGeneratingCampaign] = useState(false);
  const [isAuditingVault, setIsAuditingVault] = useState(false);
  const [isExtractingTasks, setIsExtractingTasks] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPushingToApi, setIsPushingToApi] = useState(false);
  const [isSyncingDaily, setIsSyncingDaily] = useState(false);

  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "info" | "warning";
    title: string;
    text: string;
  } | null>(null);

  const firedReminderKeysRef = useRef<Set<string>>(
    new Set(
      storage.loadAppState<string[]>(
        APP_STATE_KEYS.FIRED_REMINDERS,
        [],
        AppStateSchemas.firedReminderKeys
      )
    )
  );

  const showToast = (type: "success" | "info" | "warning", title: string, text: string) => {
    setToastMessage({ type, title, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setActiveTab("dashboard");
        setTimeout(() => {
          const searchInput = document.querySelector('input[placeholder*="Pesquisa Universal"]') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        }, 80);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    api.checkHealth().then((h) => {
      if (!h.hasApiKey) {
        console.log("Backend executando. Motor Local inteligente ativo por padrão.");
      }
    });

    if (!auditInsight && notes.length > 0) {
      void runVaultAudit();
    }
  }, []);

  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      let changed = false;

      tasks.forEach((task) => {
        const eventKey = reminderEventKey(task);
        if (!eventKey || firedReminderKeysRef.current.has(eventKey)) return;
        if (!isReminderDue(task, now)) return;

        firedReminderKeysRef.current.add(eventKey);
        changed = true;
        showToast(
          "warning",
          "⏰ Lembrete Obsidian Ativado!",
          `Tarefa: ${task.title} (${task.channel || "Geral"})`
        );
      });

      if (changed) {
        const keys = pruneFiredReminderKeys(Array.from(firedReminderKeysRef.current));
        firedReminderKeysRef.current = new Set(keys);
        storage.saveAppState(APP_STATE_KEYS.FIRED_REMINDERS, keys);
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 30_000);
    return () => clearInterval(interval);
  }, [tasks]);

  const existingFolders = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => set.add(n.folder || "Raiz"));
    return Array.from(set).sort();
  }, [notes]);

  const runVaultAudit = useCallback(async () => {
    setIsAuditingVault(true);
    try {
      if (engineMode === "local") {
        const localAudit = analyzeLocalVault(notes);
        setAuditInsight(localAudit);
        return;
      }

      const overview = notes.map((n) => ({
        path: n.path,
        title: n.title,
        folder: n.folder,
        tags: n.tags,
        frontmatter: n.frontmatter,
      }));

      const res = await api.analyzeVault(overview);
      if (res.success && res.data) {
        setAuditInsight(res.data);
      } else {
        setAuditInsight(analyzeLocalVault(notes));
      }
    } catch (err: any) {
      console.warn("Audit error, using local engine fallback:", err);
      setAuditInsight(analyzeLocalVault(notes));
    } finally {
      setIsAuditingVault(false);
    }
  }, [notes, engineMode]);

  const handleGenerateCampaign = async (params: {
    campaignName: string;
    objective: string;
    channels: string[];
    audience: string;
    tone: string;
    selectedNotePaths: string[];
    customInstructions?: string;
  }) => {
    setIsGeneratingCampaign(true);
    try {
      const matchedNotes = notes.filter((n) => params.selectedNotePaths.includes(n.path));
      let d: any;

      if (engineMode === "local") {
        d = generateLocalCampaign({
          campaignName: params.campaignName,
          objective: params.objective,
          channels: params.channels,
          audience: params.audience,
          tone: params.tone,
          contextNotesList: matchedNotes,
          customInstructions: params.customInstructions,
        });
      } else {
        try {
          const response = await api.generateCampaign({
            campaignName: params.campaignName,
            objective: params.objective,
            channels: params.channels,
            audience: params.audience,
            tone: params.tone,
            knowledgeNotes: notes,
            preferredSourcePaths: params.selectedNotePaths,
            customInstructions: params.customInstructions,
          });
          if (response.success && response.data) {
            d = response.data;
          } else {
            throw new Error("Falha na API da IA");
          }
        } catch (apiErr) {
          console.warn("API unavailable, using local engine fallback:", apiErr);
          d = generateLocalCampaign({
            campaignName: params.campaignName,
            objective: params.objective,
            channels: params.channels,
            audience: params.audience,
            tone: params.tone,
            contextNotesList: matchedNotes,
            customInstructions: params.customInstructions,
          });
        }
      }

      const newCampaignId = `camp-${Date.now()}`;
      const outputNotePath = `04_Campanhas/${params.campaignName}.md`;
      const today = localDateKey();

      const newCampaign: MarketingCampaign = {
        id: newCampaignId,
        title: params.campaignName,
        objective: params.objective,
        targetAudience: params.audience,
        tone: params.tone,
        status: "active",
        channels: params.channels,
        channelsContent: d.channelsContent || [],
        linkedNotePaths: params.selectedNotePaths,
        obsidianOutputNotePath: outputNotePath,
        summary: d.summary || "",
        strategy: d.strategy || "",
        startDate: today,
        endDate: localDateKey(new Date(Date.now() + 86400000 * 20)),
        createdDate: today,
      };

      const generatedMarkdown = d.obsidianMarkdownNote || d.obsidianNoteMarkdown;
      if (generatedMarkdown) {
        const newNote: ObsidianNote = {
          id: `note-${Date.now()}`,
          path: outputNotePath,
          title: params.campaignName,
          folder: "04_Campanhas",
          content: generatedMarkdown,
          frontmatter: {
            title: params.campaignName,
            tags: ["campanha", "marketing-local", ...(params.channels || []).map((c) => (c || "").toLowerCase().replace(/\s+/g, "-")).filter(Boolean)],
            status: "Ativo",
            publish_date: today,
            channel: params.channels.join(", "),
          },
          tags: ["campanha", "marketing-local"],
          wikilinks: params.selectedNotePaths.map((p) => p.split("/").pop()?.replace(".md", "") || ""),
          lastModified: new Date().toISOString().replace("T", " ").slice(0, 16),
          syncedWithApi: false,
        };
        setNotes((prev) => [newNote, ...prev]);
      }

      if (d.tasks && Array.isArray(d.tasks)) {
        const generatedTasks: MarketingTask[] = d.tasks.map((t: any, idx: number) => ({
          id: `task-${Date.now()}-${idx}`,
          title: t.title,
          description: t.description || "",
          channel: t.channel || "Geral",
          priority: t.priority || "medium",
          status: "todo",
          dueDate: t.dueDate || today,
          dueTime: t.dueTime || "14:00",
          reminderDate: t.dueDate || today,
          reminderTime: t.reminderTime || "11:00",
          obsidianTaskString: t.obsidianTaskString || formatToObsidianTask(t),
          obsidianFilePath: outputNotePath,
          linkedCampaignId: newCampaignId,
          tags: ["marketing", "campanha"],
          isReminderActive: true,
        }));

        setTasks((prev) => [...generatedTasks, ...prev]);
      }

      setCampaigns((prev) => [newCampaign, ...prev]);
      showToast(
        "success",
        engineMode === "local" ? "Campanha Gerada (Motor Local • 0 Tokens)!" : "Campanha Gerada com IA!",
        `Nota e ${d.tasks?.length || 0} tarefas integradas à sua base do Obsidian.`
      );
    } catch (err: any) {
      console.warn("Error creating campaign:", err);
      showToast("warning", "Aviso ao Gerar Campanha", err.message || "Erro na geração.");
    } finally {
      setIsGeneratingCampaign(false);
    }
  };

  const handleExtractTasksFromNote = async (note: ObsidianNote) => {
    setIsExtractingTasks(true);
    try {
      let tasksData: any;
      if (engineMode === "local") {
        tasksData = extractLocalTasksFromNote({
          noteTitle: note.title,
          noteContent: note.content,
        });
      } else {
        try {
          const res = await api.extractTasks({
            noteTitle: note.title,
            noteContent: note.content,
          });
          if (res.success && res.data?.extractedTasks) {
            tasksData = res.data;
          } else {
            throw new Error("Falha na API");
          }
        } catch {
          tasksData = extractLocalTasksFromNote({
            noteTitle: note.title,
            noteContent: note.content,
          });
        }
      }

      if (tasksData?.extractedTasks) {
        const today = localDateKey();
        const newTasks: MarketingTask[] = tasksData.extractedTasks.map(
          (t: any, idx: number) => ({
            id: `task-${Date.now()}-${idx}`,
            title: t.title,
            channel: t.channel || "Geral",
            priority: t.priority || "medium",
            status: "todo",
            dueDate: t.dueDate || today,
            dueTime: t.dueTime || "12:00",
            reminderDate: t.reminderDate || t.dueDate || today,
            reminderTime: t.reminderTime || "09:00",
            obsidianTaskString: t.obsidianTaskString || formatToObsidianTask(t),
            obsidianFilePath: note.path,
            tags: ["obsidian-extraido", note.tags[0] || "marketing"],
            isReminderActive: true,
          })
        );

        setTasks((prev) => [...newTasks, ...prev]);
        showToast(
          "success",
          engineMode === "local" ? "Tarefas Extraídas (Motor Local • 0 Tokens)!" : "Tarefas Extraídas com IA!",
          `${newTasks.length} tarefas e lembretes criados a partir de [[${note.title}]].`
        );
        setActiveTab("tasks");
        confetti({ particleCount: 40, spread: 60 });
      }
    } catch (err: any) {
      showToast("warning", "Erro na Extração de Tarefas", err.message || "Falha na extração");
    } finally {
      setIsExtractingTasks(false);
    }
  };

  const handlePushNoteToObsidianApi = async (note: ObsidianNote) => {
    setIsPushingToApi(true);
    try {
      const res = await api.pushNoteToObsidian(apiConfig, note.path, note.content);
      if (res.success) {
        showToast("success", "Sincronizado com Obsidian!", `Nota salva em ${note.path}`);
      } else {
        showToast(
          "info",
          "Nota Pronta para o Obsidian",
          `Use 'Abrir no App' ou copie o Markdown. (${res.message || "REST API Offline"})`
        );
      }
    } catch {
      showToast(
        "info",
        "Nota Salva Localmente",
        "Clique em 'Abrir no App' para carregar no Obsidian Desktop via URI scheme."
      );
    } finally {
      setIsPushingToApi(false);
    }
  };

  const syncManagedDailySection = async (
    sectionId: string,
    heading: string,
    body: string
  ): Promise<boolean> => {
    const today = localDateKey();
    const dailyPath = storage.getDailyNotePath(today);
    const safeBody = body.trim() || "_Nenhum item pendente._";

    const remoteResult = await api
      .upsertDailyNoteSection(apiConfig, sectionId, heading, safeBody)
      .catch(() => ({ success: false }));

    const success = Boolean(remoteResult?.success);

    if (success) {
      setNotes((prev) => {
        const existingDaily = prev.find((n) => n.path === dailyPath);
        if (existingDaily) {
          const updated: ObsidianNote = {
            ...existingDaily,
            content: upsertManagedSection(existingDaily.content, sectionId, heading, safeBody),
            lastModified: new Date().toISOString().replace("T", " ").slice(0, 16),
            syncedWithApi: true,
          };
          return prev.map((n) => (n.id === existingDaily.id ? updated : n));
        }

        const content = `# 📅 Daily Note: ${today}\n\n${upsertManagedSection("", sectionId, heading, safeBody)}`;
        return [createDailyNote(today, content), ...prev];
      });
    }

    return success;
  };

  const syncPendingTasksToDaily = async (silent = false): Promise<boolean> => {
    setIsSyncingDaily(true);
    try {
      const pendingTasks = tasks.filter((t) => t.status !== "done");
      const pendingTaskList = pendingTasks.map((t) => t.obsidianTaskString).join("\n");
      const today = localDateKey();
      const dailyPath = storage.getDailyNotePath(today);

      const remoteSuccess = await syncManagedDailySection(
        DAILY_TASKS_SECTION_ID,
        "📋 Tarefas Sincronizadas do Gestor de Marketing",
        pendingTaskList
      );

      await storage.logAudit({
        action: "DAILY_NOTE_APPENDED",
        entityType: "NOTE",
        entityId: dailyPath,
        details: `Seção idempotente atualizada com ${pendingTasks.length} tarefas pendentes na Daily Note ${today}.`,
      });

      if (!silent) {
        showToast(
          remoteSuccess ? "success" : "info",
          remoteSuccess ? "Daily Note Sincronizada!" : "Daily Note Atualizada Localmente",
          remoteSuccess
            ? `Tarefas sincronizadas sem duplicação em ${dailyPath}.`
            : `Estado local atualizado em ${dailyPath}; o Obsidian externo não confirmou a gravação.`
        );
        if (remoteSuccess) confetti({ particleCount: 30, spread: 50 });
      }

      return remoteSuccess;
    } finally {
      setIsSyncingDaily(false);
    }
  };

  const handleSyncDailyNote = () => syncPendingTasksToDaily(false);

  const handleSyncRoutineToDailyNotes = async () => {
    setIsSyncingDaily(true);
    try {
      const anchor = new Date();
      const today = localDateKey(anchor);
      const weekStart = localDateKey(startOfWeekMonday(anchor));
      const dailyPath = storage.getDailyNotePath(today);
      const sectionId = `weekly-routine-${weekStart}`;

      const routineTasksText = weeklyRoutine
        .map((slot) => {
          const slotDate = dateForRoutineDay(slot.dayOfWeek, anchor);
          return `- [ ] Publicar ${slot.dayOfWeek}: ${slot.focusTheme} 📅 ${slotDate} ⏰ ${slot.optimalTime} #marketing/rotina #${slot.primaryEmotion} #${slot.primaryNiche}`;
        })
        .join("\n");

      const newTasks: MarketingTask[] = weeklyRoutine.map((slot) => {
        const slotDate = dateForRoutineDay(slot.dayOfWeek, anchor);
        return {
          id: stableRoutineTaskId(anchor, slot.id),
          title: `Publicar ${slot.dayOfWeek}: ${slot.focusTheme}`,
          description: `Formato: ${slot.recommendedFormat.toUpperCase()} | Emoção: ${slot.primaryEmotion} | Nicho: ${slot.primaryNiche}\nHook: "${slot.suggestedHookPattern}"`,
          channel: slot.recommendedFormat === "newsletter" ? "Email Newsletter" : slot.recommendedFormat === "carrossel" ? "LinkedIn" : "Instagram",
          priority: "high",
          status: "todo",
          dueDate: slotDate,
          dueTime: slot.optimalTime,
          reminderDate: slotDate,
          reminderTime: slot.optimalTime,
          obsidianTaskString: `- [ ] Publicar ${slot.dayOfWeek}: ${slot.focusTheme} 📅 ${slotDate} ⏰ ${slot.optimalTime} #marketing/rotina`,
          obsidianFilePath: dailyPath,
          tags: ["marketing-rotina", slot.primaryEmotion, slot.primaryNiche],
          isReminderActive: true,
        };
      });

      setTasks((prev) => upsertItemsById(prev, newTasks));

      const remoteSuccess = await syncManagedDailySection(
        sectionId,
        "🗓️ Rotina Semanal de Conteúdo (Gatilhos Emocionais & Nichos)",
        routineTasksText
      );

      await storage.logAudit({
        action: "DAILY_NOTE_APPENDED",
        entityType: "NOTE",
        entityId: dailyPath,
        details: `Rotina da semana ${weekStart} sincronizada idempotentemente com ${weeklyRoutine.length} slots.`,
      });

      showToast(
        remoteSuccess ? "success" : "info",
        remoteSuccess ? "Rotina Sincronizada!" : "Rotina Atualizada Localmente",
        `${weeklyRoutine.length} slots foram atualizados por ID estável, sem criar tarefas duplicadas.`
      );
      if (remoteSuccess) confetti({ particleCount: 40, spread: 60 });
    } catch (err: any) {
      showToast("warning", "Falha na Rotina", err.message || "Não foi possível sincronizar a rotina.");
    } finally {
      setIsSyncingDaily(false);
    }
  };

  const handleSyncNow = async () => {
    if (apiConfig.connectionStatus !== "connected") {
      showToast(
        "warning",
        "Sincronização Indisponível",
        "Você precisa conectar o Obsidian nas Configurações antes de sincronizar."
      );
      setIsSettingsOpen(true);
      return;
    }
    setIsSyncing(true);
    try {
      let detectedVault = apiConfig.vaultName;
      if (window.electronAPI) {
        const vaultPath = await window.electronAPI.getVaultPath();
        if (vaultPath) {
          const pathSegments = vaultPath.replace(/\\/g, '/').split('/');
          const baseName = pathSegments.filter(Boolean).pop();
          if (baseName && baseName !== apiConfig.vaultName) {
            detectedVault = baseName;
          }
        }
      } else {
        try {
          const targetEndpoint = normalizeObsidianEndpoint(apiConfig.endpoint);
          const testRes = await fetch(`${targetEndpoint}/`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${apiConfig.apiKey}`,
              Accept: "application/json",
            },
          });
          if (testRes.ok) {
            const serverData = await testRes.json();
            if (serverData.vault) {
              detectedVault = serverData.vault;
            }
          }
        } catch (e) {
          console.warn("Could not query root endpoint for vault name:", e);
        }
      }

      let desktopNotes: ObsidianNote[] | null = null;
      if (window.electronAPI) {
        desktopNotes = await storage.readDesktopNotesForApp();
      } else {
        try {
          desktopNotes = await api.syncWebObsidianNotes(apiConfig);
        } catch (e: any) {
          console.warn("Could not sync web notes:", e);
          throw new Error(`Erro ao conectar com o Obsidian local: ${e.message || e}. Certifique-se de que o Obsidian está aberto e o certificado de segurança foi aceito.`);
        }
      }

      if (Array.isArray(desktopNotes)) {
        setNotes((prev) => {
          const merged = mergeByPath(prev, desktopNotes);
          setSelectedNote((selected) => {
            if (!selected) return merged[0] || null;
            return merged.find((note) => note.path === selected.path) || merged[0] || null;
          });
          return merged;
        });
      }

      const syncedAt = new Date().toISOString();
      updateAndSaveApiConfig((prev) => ({ ...prev, lastSyncTime: syncedAt, vaultName: detectedVault }));

      await storage.logAudit({
        action: "VAULT_SYNCED",
        entityType: "VAULT",
        entityId: detectedVault || "MarketingVault",
        details: `Sincronização real concluída em ${syncedAt}.`,
      });
      showToast(
        "success",
        "Sincronização Concluída",
        `Cofre "${detectedVault}" sincronizado com sucesso.`
      );
    } catch (err: any) {
      showToast("warning", "Erro de Sincronização", err.message || "Falha ao sincronizar com o Vault.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTestConnection = async (cfg: ObsidianApiConfig) => {
    const res = await api.testObsidianConnection({
      endpoint: cfg.endpoint,
      apiKey: cfg.apiKey,
    });
    if (res.success) {
      updateAndSaveApiConfig((prev) => ({
        ...prev,
        connectionStatus: "connected",
        vaultName: res.detectedVaultName || prev.vaultName || "MarketingVault"
      }));
    } else {
      updateAndSaveApiConfig((prev) => ({ ...prev, connectionStatus: "disconnected" }));
    }
    return res;
  };

  const handleToggleTaskStatus = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const nextStatus = t.status === "done" ? "todo" : "done";
          const checkChar = nextStatus === "done" ? "x" : " ";
          const baseString = t.obsidianTaskString || formatToObsidianTask(t);
          const updatedString = baseString.includes("[ ]") || baseString.includes("[x]") || baseString.includes("[X]")
            ? baseString.replace(/\[([ xX])\]/, `[${checkChar}]`)
            : `- [${checkChar}] ${t.title}`;
          return {
            ...t,
            status: nextStatus,
            obsidianTaskString: updatedString,
            completedAt: nextStatus === "done" ? new Date().toISOString() : undefined,
          };
        }
        return t;
      })
    );
  };

  const handleUpdateTask = (updatedTask: MarketingTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    showToast("info", "Tarefa Removida", "A tarefa foi removida da lista.");
  };

  const handleToggleRule = (ruleId: string) => {
    setAutomationRules((prev) => {
      if (prev.some((r) => r.id === ruleId)) {
        return prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
      }

      let name = ruleId;
      let description = "Regra de automação do Vault";
      let trigger: "on_campaign_created" | "daily_schedule" | "on_note_tagged" | "reminder_triggered" = "daily_schedule";
      let action: "create_tasks_in_daily_note" | "schedule_reminders" | "push_to_obsidian_api" | "generate_status_report" = "create_tasks_in_daily_note";

      if (ruleId === "rule_daily_sync") {
        name = "Sincronizador da Nota Diária";
        description = "Sincroniza tarefas concluídas e pendentes na nota diária.";
        trigger = "daily_schedule";
        action = "create_tasks_in_daily_note";
      } else if (ruleId === "rule_auto_tasks") {
        name = "Gerador de Subtarefas por Campanha";
        description = "Gera e agenda tarefas padrões do processo para novas campanhas.";
        trigger = "on_campaign_created";
        action = "schedule_reminders";
      } else if (ruleId === "rule_vault_audit") {
        name = "Auditoria e Indexação Contínua";
        description = "Mapeia tom e diretrizes para o motor local.";
        trigger = "on_note_tagged";
        action = "push_to_obsidian_api";
      }

      return [...prev, { id: ruleId, name, description, trigger, action, enabled: false, executionCount: 0 }];
    });
  };

  const handleRunRuleNow = async (ruleId: string) => {
    if (apiConfig.connectionStatus !== "connected") {
      showToast("warning", "Obsidian Desconectado", "O cofre do Obsidian deve estar conectado para executar automações.");
      return;
    }

    const today = localDateKey();

    if (ruleId === "rule_auto_tasks") {
      let syncedCount = 0;
      campaigns.forEach((camp) => {
        const expectedPath = camp.obsidianOutputNotePath || `04_Campanhas/${camp.title}.md`;
        const exists = notes.some((n) => n.path === expectedPath);
        if (!exists) {
          const newCampNote: ObsidianNote = {
            id: `note-camp-${Date.now()}-${syncedCount}`,
            path: expectedPath,
            title: camp.title,
            folder: "04_Campanhas",
            content: `# 🚀 ${camp.title}\n\n## 🎯 Objetivo\n${camp.objective}\n\n## 📝 Estratégia\n${camp.strategy}\n\n## 📑 Resumo\n${camp.summary}`,
            frontmatter: {
              id: `camp_${Date.now()}_${syncedCount}`,
              tipo: "Campanha de Marketing",
              title: camp.title,
              tags: ["campanha", "marketing-nisti"],
              status: "OFICIAL",
              channels: (camp.channels || []).join(", "),
              publish_date: camp.startDate,
              owner: "Gestor de Marketing Nisti Print",
              created_at: today,
              updated_at: today,
              confidencialidade: "Interno",
              produto: "Linha Nisti Print",
              nicho: "Papelaria & B2B",
              canal: "Omnichannel",
              projeto: camp.title,
              origem: "Gerador de Campanhas",
              approved_by: "Gestor de Marketing",
              hash: `np_camp_${Date.now()}`,
            },
            tags: ["campanha", "marketing-nisti"],
            wikilinks: ["01_Estrategia/Brand Voice & Posicionamento Nisti Print"],
            lastModified: new Date().toISOString().replace("T", " ").slice(0, 16),
            syncedWithApi: true,
          };
          setNotes((prev) => [newCampNote, ...prev]);
          if (apiConfig.connectionStatus === "connected") {
            void handlePushNoteToObsidianApi(newCampNote);
          }
          syncedCount++;
        }
      });

      await storage.logAudit({
        action: "AUTOMATION_TRIGGERED",
        entityType: "AUTOMATION",
        entityId: ruleId,
        details: `${syncedCount} novas notas de campanha criadas na pasta 04_Campanhas.`,
      });

      showToast(
        "success",
        "Automação Executada!",
        syncedCount > 0
          ? (apiConfig.connectionStatus === "connected" ? `${syncedCount} notas de campanha estruturadas em 04_Campanhas.` : `${syncedCount} notas estruturadas apenas localmente (Cofre Desconectado).`)
          : "Todas as campanhas já estão sincronizadas em 04_Campanhas."
      );
    } else if (ruleId === "rule_vault_audit") {
      const inboxNotes = notes.filter(
        (n) => n.folder === "00_Inbox" && n.frontmatter?.status !== "OFICIAL"
      );

      if (inboxNotes.length > 0) {
        const triageTask: MarketingTask = {
          id: `triage-task-${today}`,
          title: `Triagem Obrigatória: ${inboxNotes.length} notas pendentes em 00_Inbox`,
          description: `Notas aguardando revisão humana: ${inboxNotes.map((n) => n.title).join(", ")}`,
          channel: "Interno",
          priority: "high",
          status: "todo",
          dueDate: today,
          dueTime: "16:00",
          reminderDate: today,
          reminderTime: "15:00",
          obsidianTaskString: `- [ ] Triagem de ${inboxNotes.length} notas em 00_Inbox 📅 ${today} #curadoria #pkm`,
          tags: ["curadoria", "inbox", "pkm"],
          isReminderActive: true,
        };
        setTasks((prev) => upsertItemsById(prev, [triageTask]));

        await storage.logAudit({
          action: "AUTOMATION_TRIGGERED",
          entityType: "AUTOMATION",
          entityId: ruleId,
          details: `Tarefa idempotente de triagem atualizada para ${inboxNotes.length} notas pendentes em 00_Inbox.`,
        });

        showToast(
          "success",
          "Triagem de Inbox Concluída!",
          `Tarefa diária de triagem atualizada para ${inboxNotes.length} notas pendentes.`
        );
      } else {
        showToast("info", "Inbox em Dia!", "Nenhuma nota pendente de triagem em 00_Inbox.");
      }
    } else if (ruleId === "rule_daily_sync") {
      const pendingHighTasks = tasks.filter((t) => t.status !== "done" && t.priority === "high");
      const taskLines = pendingHighTasks.map((t) => t.obsidianTaskString).join("\n");
      await syncManagedDailySection(
        AUTOMATION_HIGH_PRIORITY_SECTION_ID,
        "⚡ Tarefas de Alta Prioridade",
        taskLines
      );
      await storage.logAudit({
        action: "AUTOMATION_TRIGGERED",
        entityType: "AUTOMATION",
        entityId: ruleId,
        details: "Regra executada e seção de alta prioridade reconciliada de forma idempotente.",
      });
      showToast("success", "Automação Executada!", "Regra processada e reconciliada no cofre.");
    }

    setAutomationRules((prev) => {
      if (prev.some((r) => r.id === ruleId)) {
        return prev.map((r) =>
          r.id === ruleId
            ? {
                ...r,
                executionCount: r.executionCount + 1,
                lastRun: new Date().toISOString().replace("T", " ").slice(0, 16),
              }
            : r
        );
      }

      let name = ruleId;
      let description = "Regra de automação do Vault";
      let trigger: "on_campaign_created" | "daily_schedule" | "on_note_tagged" | "reminder_triggered" = "daily_schedule";
      let action: "create_tasks_in_daily_note" | "schedule_reminders" | "push_to_obsidian_api" | "generate_status_report" = "create_tasks_in_daily_note";

      if (ruleId === "rule_daily_sync") {
        name = "Sincronizador da Nota Diária";
        description = "Sincroniza tarefas concluídas e pendentes na nota diária.";
        trigger = "daily_schedule";
        action = "create_tasks_in_daily_note";
      } else if (ruleId === "rule_auto_tasks") {
        name = "Gerador de Subtarefas por Campanha";
        description = "Gera e agenda tarefas padrões do processo para novas campanhas.";
        trigger = "on_campaign_created";
        action = "schedule_reminders";
      } else if (ruleId === "rule_vault_audit") {
        name = "Auditoria e Indexação Contínua";
        description = "Mapeia tom e diretrizes para o motor local.";
        trigger = "on_note_tagged";
        action = "push_to_obsidian_api";
      }

      return [
        ...prev,
        {
          id: ruleId,
          name,
          description,
          trigger,
          action,
          enabled: true,
          executionCount: 1,
          lastRun: new Date().toISOString().replace("T", " ").slice(0, 16),
        },
      ];
    });
    confetti({ particleCount: 25 });
  };

  const handleExportVault = () => {
    const sanitizedApiConfig = { ...apiConfig } as Record<string, unknown>;
    delete sanitizedApiConfig.apiKey;
    delete sanitizedApiConfig.geminiApiKey;
    delete sanitizedApiConfig.openaiApiKey;

    const dataStr = JSON.stringify(
      {
        version: APP_VERSION,
        notes,
        campaigns,
        tasks,
        apiConfig: sanitizedApiConfig,
      },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `obsidian-marketing-vault-v${APP_VERSION}-${localDateKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("success", "Backup Exportado", `Backup v${APP_VERSION} exportado sem credenciais.`);
  };

  const handleClearAllData = useCallback(async () => {
    await storage.factoryResetAll();
    setNotes([]);
    setCampaigns([]);
    setTasks([]);
    setAutomationRules([]);
    setIdeas([]);
    setScripts([]);
    setVisuals([]);
    setPostHistory([]);
    setLearnings([]);
    setWeeklyRoutine([]);
    setNiches([]);
    setSelectedNote(null);
    showToast("info", "Reset de Fábrica Concluído", "Todo o armazenamento local foi zerado e restaurado aos padrões limpos de fábrica.");
  }, [
    setNotes,
    setCampaigns,
    setTasks,
    setAutomationRules,
    setIdeas,
    setScripts,
    setVisuals,
    setPostHistory,
    setLearnings,
    setWeeklyRoutine,
    setNiches,
    setSelectedNote,
    showToast,
  ]);

  const handleImportVault = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string) as unknown;
        const parsed = parseWorkspaceImport(raw);
        setNotes(parsed.notes as ObsidianNote[]);
        setCampaigns(parsed.campaigns as MarketingCampaign[]);
        setTasks(parsed.tasks as MarketingTask[]);
        showToast(
          "success",
          "Cofre Importado!",
          `Backup ${parsed.version ? `v${parsed.version}` : "legado"} validado com Zod e restaurado sem importar segredos.`
        );
      } catch (err: any) {
        console.warn("Workspace import rejected:", err);
        showToast("warning", "Importação Rejeitada", "O arquivo não corresponde ao schema esperado ou contém dados inválidos.");
      }
    };
    reader.readAsText(file);
  };

  const getBlockerConfig = () => {
    switch (activeTab) {
      case "dashboard":
        return {
          title: "Painel de Controle Offline",
          description: "O painel de controle do Nisti Print PKM Marketing Hub está desativado. Conecte sua REST API do Obsidian nas Configurações para carregar e gerenciar suas métricas, tarefas e notas.",
        };
      case "vault":
        return {
          title: "Acesso ao Cofre Bloqueado",
          description: "Não é possível ler ou visualizar suas notas Markdown locais. Conecte o Obsidian para sincronizar sua base de conhecimento e diretrizes oficiais de marketing.",
        };
      case "knowledge":
        return {
          title: "Captura de Conhecimento Desativada",
          description: "Você não pode processar ou criar novas notas a partir de PDFs, YouTube ou sites enquanto o Obsidian estiver desconectado.",
        };
      case "routine":
        return {
          title: "Planejamento e Rotinas Offline",
          description: "O agendamento de cronogramas e inserção automática de pautas nas suas Daily Notes requer conexão ativa com o Obsidian.",
        };
      case "tasks":
      case "automations":
        return {
          title: "Quadro Kanban & Automações Bloqueados",
          description: "O gerenciamento de pendências e tarefas automatizadas está travado para garantir a integridade do seu Obsidian Tasks e evitar duplicados.",
        };
      case "campaigns":
        return {
          title: "Modelagem de Campanhas Travada",
          description: "A geração inteligente de estratégias criativas e de marketing está inativa porque necessita do contexto real das suas notas do Obsidian.",
        };
      default:
        return {
          title: "Obsidian Desconectado",
          description: "Conecte sua REST API do Obsidian local nas Configurações para habilitar este recurso com segurança.",
        };
    }
  };

  const showPlanningSubTabs = isPlanningSubnavigationView(activeTab);

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-text-primary flex flex-col lg:flex-row font-sans selection:bg-purple-500/30 selection:text-purple-200">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce duration-300">
          <div
            className={`p-4 rounded-xl shadow-xl border flex items-start gap-3 max-w-sm ${
              toastMessage.type === "success"
                ? "bg-stone-900 text-white border-purple-500"
                : toastMessage.type === "warning"
                ? "bg-amber-950 text-amber-100 border-amber-500"
                : "bg-stone-800 text-white border-stone-600"
            }`}
          >
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : toastMessage.type === "warning" ? (
              <Bell className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
            ) : (
              <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="text-xs font-bold">{toastMessage.title}</h4>
              <p className="text-xs text-stone-300 mt-0.5">{toastMessage.text}</p>
            </div>
          </div>
        </div>
      )}

      <div className="hidden lg:block">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          apiConfig={apiConfig}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onSyncNow={handleSyncNow}
          isSyncing={isSyncing}
          tasks={tasks}
          onQuickNewCampaign={() => {
            if (apiConfig.connectionStatus !== "connected") {
              showToast("warning", "Ação de Criação Bloqueada", "Você precisa conectar o Obsidian para criar campanhas.");
              setIsSettingsOpen(true);
              return;
            }
            setActiveTab("campaigns");
          }}
          onQuickNewTask={() => {
            if (apiConfig.connectionStatus !== "connected") {
              showToast("warning", "Ação de Criação Bloqueada", "Você precisa conectar o Obsidian para criar tarefas.");
              setIsSettingsOpen(true);
              return;
            }
            setIsTaskModalOpen(true);
          }}
          onQuickNewNote={() => {
            if (apiConfig.connectionStatus !== "connected") {
              showToast("warning", "Ação de Criação Bloqueada", "Você precisa conectar o Obsidian para criar notas.");
              setIsSettingsOpen(true);
              return;
            }
            setIsNoteModalOpen(true);
          }}
          hasApiKey={Boolean(apiConfig.apiKey.trim())}
          engineMode={engineMode}
          onToggleEngineMode={(mode) => {
            setEngineMode(mode);
            showToast(
              "info",
              mode === "local" ? "Motor Local Ativado" : "Modo IA Ativado",
              mode === "local"
                ? "Operando 100% offline com lógica determinística e 0 consumo de tokens."
                : "Operando em modo híbrido com o provedor de IA configurado."
            );
          }}
        />

        {showPlanningSubTabs && <SubTabs activeTab={activeTab} setActiveTab={setActiveTab} />}

        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col min-h-0 overflow-hidden">

          {activeTab === "dashboard" && (
            <DashboardView
              notes={notes}
              campaigns={campaigns}
              tasks={tasks}
              ideas={ideas}
              scripts={scripts}
              visuals={visuals}
              apiConfig={apiConfig}
              engineMode={engineMode}
              onNavigateTab={setActiveTab}
              onSelectNote={(note) => {
                setSelectedNote(note);
                setActiveTab("vault");
              }}
              onToggleTaskStatus={handleToggleTaskStatus}
              onOpenNewCampaignModal={() => setActiveTab("campaigns")}
              onOpenNewTaskModal={() => setIsTaskModalOpen(true)}
              onOpenNewNoteModal={() => setIsNoteModalOpen(true)}
              onAuditVault={runVaultAudit}
              isAuditing={isAuditingVault}
              auditInsight={auditInsight}
              onSyncDailyNote={handleSyncDailyNote}
              onAddIdea={(newIdea) => {
                const fullIdea: IdeaItem = {
                  ...newIdea,
                  id: `idea-${Date.now()}`,
                };
                setIdeas((prev) => [fullIdea, ...prev]);
                showToast("success", "Ideia Salva", `"${fullIdea.title}" adicionada ao banco.`);
              }}
              onUpdateIdeaStatus={(ideaId, newStatus) => {
                setIdeas((prev) =>
                  prev.map((i) => (i.id === ideaId ? { ...i, status: newStatus } : i))
                );
              }}
              onConvertIdeaToCampaign={(idea) => {
                setActiveTab("campaigns");
                showToast("info", "Convertendo Ideia", `Gerador aberto com base em "${idea.title}".`);
              }}
            />
          )}

          {activeTab === "vault" && (
            <VaultView
              notes={notes}
              selectedNote={selectedNote}
              onSelectNote={setSelectedNote}
              onUpdateNote={(updated) => {
                setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
                setSelectedNote(updated);
                showToast("success", "Nota Nota Atualizada", `Alterações salvas em [[${updated.title}]].`);
              }}
              onOpenAddSource={() => setActiveTab("knowledge")}
              onExtractTasksFromNote={handleExtractTasksFromNote}
              onGenerateCampaignFromNote={(note) => {
                setSelectedNote(note);
                setActiveTab("campaigns");
              }}
              onPushNoteToObsidianApi={handlePushNoteToObsidianApi}
              apiConfig={apiConfig}
              isExtractingTasks={isExtractingTasks}
              isPushingToApi={isPushingToApi}
            />
          )}

          {activeTab === "campaigns" && (
            <CampaignsView
              campaigns={campaigns}
              notes={notes}
              onGenerateCampaign={handleGenerateCampaign}
              isGenerating={isGeneratingCampaign}
              onSaveCampaignToObsidian={(camp) => {
                if (camp.obsidianOutputNotePath) {
                  const note = notes.find((n) => n.path === camp.obsidianOutputNotePath);
                  if (note) void handlePushNoteToObsidianApi(note);
                }
              }}
              onImportCampaignTasks={() => {
                showToast("success", "Tarefas Sincronizadas", "Tarefas da campanha ativas no quadro.");
                setActiveTab("tasks");
              }}
              apiConfig={apiConfig}
              engineMode={engineMode}
              onToggleEngineMode={setEngineMode}
            />
          )}

          {activeTab === "tasks" && (
            <TasksAutomationView
              tasks={tasks}
              automationRules={automationRules}
              onToggleTaskStatus={handleToggleTaskStatus}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onOpenNewTaskModal={() => setIsTaskModalOpen(true)}
              onToggleRule={handleToggleRule}
              onRunRuleNow={handleRunRuleNow}
              onSyncDailyNote={handleSyncDailyNote}
              apiConfig={apiConfig}
              isSyncingDaily={isSyncingDaily}
              initialSection="tasks"
            />
          )}

          {activeTab === "automations" && (
            <TasksAutomationView
              tasks={tasks}
              automationRules={automationRules}
              onToggleTaskStatus={handleToggleTaskStatus}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onOpenNewTaskModal={() => setIsTaskModalOpen(true)}
              onToggleRule={handleToggleRule}
              onRunRuleNow={handleRunRuleNow}
              onSyncDailyNote={handleSyncDailyNote}
              apiConfig={apiConfig}
              isSyncingDaily={isSyncingDaily}
              initialSection="automations"
            />
          )}

          {activeTab === "editorial" && (
            <EditorialCalendarView
              tasks={tasks}
              onTasksChange={setTasks}
              campaigns={campaigns}
              ideas={ideas}
              scripts={scripts}
              obsidianApiConfig={apiConfig}
            />
          )}

          {activeTab === "routine" && (
            <RoutineIntelligenceView
              emotionalDrivers={emotionalDrivers}
              niches={niches}
              postHistory={postHistory}
              learnings={learnings}
              weeklyRoutine={weeklyRoutine}
              apiConfig={apiConfig}
              engineMode={engineMode}
              notes={notes}
              onAddPostHistory={(newPost) => {
                const fullPost: PostHistoryItem = {
                  ...newPost,
                  id: `post-${Date.now()}`,
                };
                setPostHistory((prev) => [fullPost, ...prev]);
              }}
              onAddLearning={(newLearning) => {
                const fullLearning: LearningInsight = {
                  ...newLearning,
                  id: `learn-${Date.now()}`,
                };
                setLearnings((prev) => [fullLearning, ...prev]);
              }}
              onUpdateRoutineSlot={(slotId, updated) => {
                setWeeklyRoutine((prev) =>
                  prev.map((s) => (s.id === slotId ? { ...s, ...updated } : s))
                );
              }}
              onAddRoutineSlot={(newSlot) => {
                const fullSlot = {
                  ...newSlot,
                  id: `slot-${Date.now()}`,
                } as DailyRoutineSlot;
                setWeeklyRoutine((prev) => [...prev, fullSlot]);
              }}
              onCreateCampaignFromSuggestion={(data) => {
                setActiveTab("campaigns");
                showToast(
                  "info",
                  "Pauta Selecionada",
                  `Gerador aberto para ${data.title} (${data.niche} / ${data.emotion}).`
                );
              }}
              onSyncRoutineToDailyNotes={handleSyncRoutineToDailyNotes}
              showToast={showToast}
            />
          )}

          {activeTab === "knowledge" && (
            <AddKnowledgeView
              notes={notes}
              onAddNote={(newNote) => {
                setNotes((prev) => [newNote, ...prev]);
                if (apiConfig.connectionStatus === "connected") {
                  void handlePushNoteToObsidianApi(newNote);
                } else {
                  showToast("info", "Nota Salva Localmente", `[[${newNote.title}]] adicionada ao painel (Cofre Desconectado).`);
                }
                confetti({ particleCount: 35, spread: 65 });
              }}
              apiConfig={apiConfig}
              onNavigateTab={setActiveTab}
              onSelectNote={setSelectedNote}
              engineMode={engineMode}
            />
          )}

          {activeTab === "content" && (
            <ContentView
              ideas={ideas}
              scripts={scripts}
              notes={notes}
              onAddIdea={(idea) => setIdeas(prev => [idea, ...prev])}
              onAddScript={(script) => setScripts(prev => [script, ...prev])}
              onSaveToVault={async (content, folder, title) => {
                if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.commitKnowledge) {
                  const res = await window.electronAPI.commitKnowledge({ folder, title, content });
                  if (res && res.success) {
                    showToast("success", "Salvo no Obsidian", `O arquivo foi salvo no Vault.`);
                    await handleSyncNow();
                  } else {
                    showToast("warning", "Erro ao salvar", res?.error || "Falha desconhecida");
                  }
                }
              }}
              engineMode={engineMode}
            />
          )}
        </main>
      </div>

      <ObsidianApiSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={apiConfig}
        onSaveConfig={(cfg) => {
          updateAndSaveApiConfig(cfg);
          showToast("success", "Configurações Salvas", "Parâmetros da API do Obsidian atualizados.");
        }}
        onTestConnection={handleTestConnection}
        onExportVault={handleExportVault}
        onImportVault={handleImportVault}
        onClearAllData={handleClearAllData}
      />

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSaveTask={(newTask) => {
          setTasks((prev) => [newTask, ...prev]);
          showToast("success", "Tarefa Criada", `Formatada para Obsidian Tasks: ${newTask.title}`);
          confetti({ particleCount: 20 });
        }}
        notes={notes}
      />

      <NoteModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        onSaveNote={(newNote) => {
          setNotes((prev) => [newNote, ...prev]);
          setSelectedNote(newNote);
          setActiveTab("vault");
          showToast("success", "Nota Criada", `Documento [[${newNote.title}]] adicionado ao cofre.`);
          confetti({ particleCount: 20 });
        }}
        existingFolders={existingFolders}
      />
    </div>
  );
}
