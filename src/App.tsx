import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Navbar } from "./components/Navbar";
import { DashboardView } from "./components/DashboardView";
import { VaultView } from "./components/VaultView";
import { CampaignsView } from "./components/CampaignsView";
import { TasksAutomationView } from "./components/TasksAutomationView";
import { RoutineIntelligenceView } from "./components/RoutineIntelligenceView";
import { AddKnowledgeView } from "./components/AddKnowledgeView";
import { ObsidianApiSettingsModal } from "./components/ObsidianApiSettingsModal";
import { LocalInstallationGuideModal } from "./components/LocalInstallationGuideModal";
import { DesktopSetupWizardModal } from "./components/DesktopSetupWizardModal";
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
import { api } from "./services/api";
import { APP_STATE_KEYS, StorageManager } from "./services/storage/StorageManager";
import { usePersistentState, usePersistentTextState } from "./hooks/usePersistentState";
import { AppStateSchemas, parseWorkspaceImport } from "./domain/appStateSchemas";
import { formatToObsidianTask } from "./utils/obsidianUri";
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
import { Bell, CheckCircle2, Sparkles } from "lucide-react";

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

export default function App() {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "vault" | "campaigns" | "tasks" | "automations" | "routine" | "knowledge"
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
    endpoint: "http://127.0.0.1:27124",
    apiKey: "",
    vaultName: "MarketingVault",
    useHttps: false,
    autoSync: true,
    syncIntervalSeconds: 60,
    connectionStatus: "disconnected",
    allowSelfSignedCerts: true,
  });
  const [isApiConfigLoaded, setIsApiConfigLoaded] = useState(false);

  useEffect(() => {
    storage
      .loadApiConfig(apiConfig)
      .then((loaded) => {
        if (loaded) setApiConfig(loaded);
      })
      .finally(() => setIsApiConfigLoaded(true));
  }, []);

  useEffect(() => {
    if (!isApiConfigLoaded) return;
    void storage.saveApiConfig(apiConfig);
  }, [apiConfig, isApiConfigLoaded]);

  const [selectedNote, setSelectedNote] = useState<ObsidianNote | null>(notes[0] || null);
  const [auditInsight, setAuditInsight] = useState<VaultAuditInsight | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false);
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

    // Check if first-run setup wizard was completed
    if (typeof window !== "undefined" && !localStorage.getItem("nisti_setup_wizard_completed")) {
      setIsSetupWizardOpen(true);
    }

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
      console.error("Audit error, using local engine fallback:", err);
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
        const contextNotes = matchedNotes
          .map((n) => `--- NOTA: ${n.title} (Pasta: ${n.folder}) ---\n${n.content}`)
          .join("\n\n");

        try {
          const response = await api.generateCampaign({
            campaignName: params.campaignName,
            objective: params.objective,
            channels: params.channels,
            audience: params.audience,
            tone: params.tone,
            contextNotes,
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
      console.error("Error creating campaign:", err);
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

    setNotes((prev) => {
      const existingDaily = prev.find((n) => n.path === dailyPath);
      if (existingDaily) {
        const updated: ObsidianNote = {
          ...existingDaily,
          content: upsertManagedSection(existingDaily.content, sectionId, heading, safeBody),
          lastModified: new Date().toISOString().replace("T", " ").slice(0, 16),
        };
        return prev.map((n) => (n.id === existingDaily.id ? updated : n));
      }

      const content = `# 📅 Daily Note: ${today}\n\n${upsertManagedSection("", sectionId, heading, safeBody)}`;
      return [createDailyNote(today, content), ...prev];
    });

    const remoteResult = await api
      .upsertDailyNoteSection(apiConfig, sectionId, heading, safeBody)
      .catch(() => ({ success: false }));

    return Boolean(remoteResult?.success);
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
    setIsSyncing(true);
    try {
      const desktopNotes = await storage.readDesktopNotesForApp();
      if (desktopNotes) {
        setNotes((prev) => {
          const merged = mergeByPath(prev, desktopNotes);
          setSelectedNote((selected) => {
            if (!selected) return merged[0] || null;
            return merged.find((note) => note.path === selected.path) || selected;
          });
          return merged;
        });
      }

      const remoteSuccess = await syncPendingTasksToDaily(true);
      const syncedAt = new Date().toISOString();
      setApiConfig((prev) => ({ ...prev, lastSyncTime: syncedAt }));

      if (remoteSuccess) {
        await storage.logAudit({
          action: "VAULT_SYNCED",
          entityType: "VAULT",
          entityId: apiConfig.vaultName || "MarketingVault",
          details: `Sincronização real concluída em ${syncedAt}. Notas do Electron atualizadas e tarefas reconciliadas na Daily Note.`,
        });
        showToast("success", "Sincronização Concluída", "Vault lido e Daily Note reconciliada sem duplicação.");
      } else {
        showToast("warning", "Sincronização Parcial", "Dados locais foram reconciliados, mas o Obsidian não confirmou a gravação remota.");
      }
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
      setApiConfig((prev) => ({ ...prev, connectionStatus: "connected" }));
    } else {
      setApiConfig((prev) => ({ ...prev, connectionStatus: "disconnected" }));
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

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    showToast("info", "Tarefa Removida", "A tarefa foi removida da lista.");
  };

  const handleToggleRule = (ruleId: string) => {
    setAutomationRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleRunRuleNow = async (ruleId: string) => {
    const today = localDateKey();

    if (ruleId === "rule-1") {
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
          ? `${syncedCount} notas de campanha estruturadas em 04_Campanhas.`
          : "Todas as campanhas já estão sincronizadas em 04_Campanhas."
      );
    } else if (ruleId === "rule-2") {
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
    } else {
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

    setAutomationRules((prev) =>
      prev.map((r) =>
        r.id === ruleId
          ? {
              ...r,
              executionCount: r.executionCount + 1,
              lastRun: new Date().toISOString().replace("T", " ").slice(0, 16),
            }
          : r
      )
    );
    confetti({ particleCount: 25 });
  };

  const handleExportVault = () => {
    const sanitizedApiConfig = { ...apiConfig } as Record<string, unknown>;
    delete sanitizedApiConfig.apiKey;

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

  return (
    <div className="min-h-screen bg-stone-100/40 text-stone-900 flex flex-col font-sans selection:bg-purple-200 selection:text-purple-900">
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

      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        apiConfig={apiConfig}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenGuide={() => setIsGuideModalOpen(true)}
        onOpenSetupWizard={() => setIsSetupWizardOpen(true)}
        onSyncNow={handleSyncNow}
        isSyncing={isSyncing}
        onQuickNewCampaign={() => {
          setActiveTab("campaigns");
        }}
        onQuickNewTask={() => setIsTaskModalOpen(true)}
        onQuickNewNote={() => setIsNoteModalOpen(true)}
        hasApiKey={Boolean(apiConfig.apiKey.trim())}
        engineMode={engineMode}
        onToggleEngineMode={(mode) => {
          setEngineMode(mode);
          showToast(
            "info",
            mode === "local" ? "Motor Local Ativado" : "Modo IA Gemini Ativado",
            mode === "local"
              ? "Operando 100% offline com lógica determinística e 0 consumo de tokens."
              : "Operando em modo híbrido com a API do Gemini."
          );
        }}
      />

      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 md:py-8 overflow-y-auto pb-24 md:pb-8">
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
            onOpenGuide={() => setIsGuideModalOpen(true)}
            onOpenSetupWizard={() => setIsSetupWizardOpen(true)}
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
              showToast("success", "Nota Atualizada", `Alterações salvas em [[${updated.title}]].`);
            }}
            onOpenNewNoteModal={() => setIsNoteModalOpen(true)}
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
              showToast("success", "Nota Automatizada", `[[${newNote.title}]] inserida com sucesso no cofre.`);
              confetti({ particleCount: 35, spread: 65 });
            }}
            apiConfig={apiConfig}
            onNavigateTab={setActiveTab}
            onSelectNote={setSelectedNote}
            engineMode={engineMode}
          />
        )}
      </main>

      <ObsidianApiSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={apiConfig}
        onSaveConfig={(cfg) => {
          setApiConfig(cfg);
          showToast("success", "Configurações Salvas", "Parâmetros da API do Obsidian atualizados.");
        }}
        onTestConnection={handleTestConnection}
        onExportVault={handleExportVault}
        onImportVault={handleImportVault}
        onOpenGuide={() => setIsGuideModalOpen(true)}
      />

      <LocalInstallationGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <DesktopSetupWizardModal
        isOpen={isSetupWizardOpen}
        onClose={() => setIsSetupWizardOpen(false)}
        onComplete={(vaultPath) => {
          showToast("success", "Cofre Inicializado", `Caminho configurado: ${vaultPath}`);
          confetti({ particleCount: 40 });
        }}
        apiConfig={apiConfig}
        setApiConfig={setApiConfig}
        engineMode={engineMode}
        onToggleEngineMode={(mode) => {
          setEngineMode(mode);
          showToast(
            "info",
            mode === "local" ? "Motor Local Ativado" : "Modo IA Gemini Ativado",
            mode === "local"
              ? "Operando 100% offline com lógica determinística e 0 consumo de tokens."
              : "Operando em modo híbrido com a API do Gemini."
          );
        }}
        onOpenGuide={() => {
          setIsSetupWizardOpen(false);
          setIsGuideModalOpen(true);
        }}
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
