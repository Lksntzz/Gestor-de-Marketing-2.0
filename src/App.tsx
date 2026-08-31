import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Calendar, CheckCircle2, Sparkles } from "lucide-react";
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
import { TaskModal } from "./components/TaskModal";
import { NoteModal } from "./components/NoteModal";
import type {
  CreativeScript,
  EngineMode,
  IdeaItem,
  LearningInsight,
  MarketingCampaign,
  MarketingTask,
  ObsidianApiConfig,
  ObsidianNote,
  PostHistoryItem,
} from "./types";
import {
  DEFAULT_CAMPAIGNS,
  DEFAULT_IDEAS,
  DEFAULT_OBSIDIAN_NOTES,
  DEFAULT_SCRIPTS,
  DEFAULT_TASKS,
} from "./data/defaultVault";
import {
  DEFAULT_LEARNING_INSIGHTS,
  DEFAULT_POST_HISTORY,
} from "./data/routineData";
import { api } from "./services/api";
import {
  OBSIDIAN_CONNECTED_EVENT,
  OBSIDIAN_DISCONNECTED_EVENT,
  publishObsidianSnapshot,
} from "./services/obsidianRuntimeState";
import { APP_STATE_KEYS, StorageManager } from "./services/storage/StorageManager";
import { usePersistentState, usePersistentTextState } from "./hooks/usePersistentState";
import { AppStateSchemas, parseWorkspaceImport } from "./domain/appStateSchemas";
import { assessBaseReadiness } from "./domain/baseOnboarding";
import { extractAllTasksFromNotes } from "./domain/taskExtractor";
import {
  PLANNING_SUBNAVIGATION,
  isPlanningSubnavigationView,
  type AppViewId,
} from "./navigation/productNavigation";
import {
  APP_VERSION,
  isReminderDue,
  localDateKey,
  pruneFiredReminderKeys,
  reminderEventKey,
} from "./utils/reliability";

const storage = StorageManager.getInstance();

const DEFAULT_API_CONFIG: ObsidianApiConfig = {
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
};

const SubTabs = ({
  activeTab,
  setActiveTab,
}: {
  activeTab: AppViewId;
  setActiveTab: (tab: AppViewId) => void;
}) => (
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

export default function App() {
  const [engineMode, setEngineMode] = usePersistentTextState<EngineMode>(
    APP_STATE_KEYS.ENGINE_MODE,
    "local",
    AppStateSchemas.engineMode,
  );
  const [notes, setNotes] = usePersistentState<ObsidianNote[]>(
    APP_STATE_KEYS.NOTES,
    DEFAULT_OBSIDIAN_NOTES,
    AppStateSchemas.notes,
  );
  const [campaigns, setCampaigns] = usePersistentState<MarketingCampaign[]>(
    APP_STATE_KEYS.CAMPAIGNS,
    DEFAULT_CAMPAIGNS,
    AppStateSchemas.campaigns,
  );
  const [tasks, setTasks] = usePersistentState<MarketingTask[]>(
    APP_STATE_KEYS.TASKS,
    DEFAULT_TASKS,
    AppStateSchemas.tasks,
  );
  const [ideas, setIdeas] = usePersistentState<IdeaItem[]>(
    APP_STATE_KEYS.IDEAS,
    DEFAULT_IDEAS,
    AppStateSchemas.ideas,
  );
  const [scripts, setScripts] = usePersistentState<CreativeScript[]>(
    APP_STATE_KEYS.SCRIPTS,
    DEFAULT_SCRIPTS,
    AppStateSchemas.scripts,
  );
  const [postHistory, setPostHistory] = usePersistentState<PostHistoryItem[]>(
    APP_STATE_KEYS.POST_HISTORY,
    DEFAULT_POST_HISTORY,
    AppStateSchemas.postHistory,
  );
  const [learnings, setLearnings] = usePersistentState<LearningInsight[]>(
    APP_STATE_KEYS.LEARNINGS,
    DEFAULT_LEARNING_INSIGHTS,
    AppStateSchemas.learnings,
  );

  const [activeTab, setActiveTab] = useState<AppViewId>(() =>
    assessBaseReadiness(notes).complete ? "dashboard" : "vault",
  );
  const [selectedNote, setSelectedNote] = useState<ObsidianNote | null>(notes[0] || null);
  const [apiConfig, setApiConfig] = useState<ObsidianApiConfig>(DEFAULT_API_CONFIG);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPushingToVault, setIsPushingToVault] = useState(false);
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
        AppStateSchemas.firedReminderKeys,
      ),
    ),
  );

  const showToast = useCallback(
    (type: "success" | "info" | "warning", title: string, text: string) => {
      setToastMessage({ type, title, text });
      window.setTimeout(() => setToastMessage(null), 4000);
    },
    [],
  );

  const updateAndSaveApiConfig = useCallback(
    (update: ObsidianApiConfig | ((previous: ObsidianApiConfig) => ObsidianApiConfig)) => {
      setApiConfig((previous) => {
        const next = typeof update === "function" ? update(previous) : update;
        window.setTimeout(() => {
          void storage.saveApiConfig(next);
          const webCredentialsMissing =
            !window.electronAPI && (!next.endpoint?.trim() || !next.apiKey?.trim());
          if (next.connectionStatus !== "connected" || webCredentialsMissing) {
            api.disconnectObsidianSession("A Base foi desconectada ou sua configuração deixou de ser válida.");
          }
        }, 0);
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void storage.loadApiConfig(DEFAULT_API_CONFIG).then(async (loaded) => {
      if (cancelled || !loaded) return;

      const canProbe = Boolean(
        window.electronAPI || (loaded.endpoint?.trim() && loaded.apiKey?.trim()),
      );
      if (canProbe) {
        try {
          const result = await api.probeObsidianConnection(loaded);
          if (!cancelled && result.success) {
            const connected: ObsidianApiConfig = {
              ...loaded,
              connectionStatus: "connected",
              errorMessage: undefined,
              vaultName: result.detectedVaultName || loaded.vaultName || "MarketingVault",
            };
            setApiConfig(connected);
            void storage.saveApiConfig(connected);
            return;
          }
        } catch (error) {
          console.warn("Não foi possível abrir a Base automaticamente.", error);
        }
      }

      if (!cancelled) {
        const disconnected = { ...loaded, connectionStatus: "disconnected" as const };
        setApiConfig(disconnected);
        void storage.saveApiConfig(disconnected);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onConnected = () => {
      setApiConfig((previous) => {
        if (previous.connectionStatus === "connected") return previous;
        const next = { ...previous, connectionStatus: "connected" as const, errorMessage: undefined };
        void storage.saveApiConfig(next);
        return next;
      });
    };
    const onDisconnected = (event: Event) => {
      const reason = (event as CustomEvent<{ reason?: string }>).detail?.reason;
      setApiConfig((previous) => {
        if (previous.connectionStatus === "disconnected" && previous.errorMessage === reason) return previous;
        const next = {
          ...previous,
          connectionStatus: "disconnected" as const,
          errorMessage: reason,
        };
        void storage.saveApiConfig(next);
        return next;
      });
    };

    window.addEventListener(OBSIDIAN_CONNECTED_EVENT, onConnected);
    window.addEventListener(OBSIDIAN_DISCONNECTED_EVENT, onDisconnected as EventListener);
    return () => {
      window.removeEventListener(OBSIDIAN_CONNECTED_EVENT, onConnected);
      window.removeEventListener(OBSIDIAN_DISCONNECTED_EVENT, onDisconnected as EventListener);
    };
  }, []);

  useEffect(() => {
    setSelectedNote((current) => {
      if (current) {
        const refreshed = notes.find((note) => note.path === current.path);
        if (refreshed) return refreshed;
      }
      return notes[0] || null;
    });
  }, [notes]);

  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      let changed = false;

      for (const task of tasks) {
        const eventKey = reminderEventKey(task);
        if (!eventKey || firedReminderKeysRef.current.has(eventKey) || !isReminderDue(task, now)) continue;
        firedReminderKeysRef.current.add(eventKey);
        changed = true;
        showToast("warning", "Lembrete de tarefa", task.title);
      }

      if (changed) {
        const keys = pruneFiredReminderKeys(Array.from(firedReminderKeysRef.current));
        firedReminderKeysRef.current = new Set(keys);
        storage.saveAppState(APP_STATE_KEYS.FIRED_REMINDERS, keys);
      }
    };

    checkReminders();
    const timer = window.setInterval(checkReminders, 30_000);
    return () => window.clearInterval(timer);
  }, [tasks, showToast]);

  const existingFolders = useMemo(() => {
    const folders = new Set(notes.map((note) => note.folder || "00_Inbox"));
    return Array.from(folders).sort((left, right) => left.localeCompare(right, "pt-BR"));
  }, [notes]);

  const handleSyncNow = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      let detectedVault = apiConfig.vaultName || "MarketingVault";
      let physicalNotes: ObsidianNote[] = [];
      let folders: string[] = [];

      if (window.electronAPI) {
        const verification = await api.probeObsidianConnection(apiConfig);
        if (!verification.success) throw new Error(verification.message);

        detectedVault = verification.detectedVaultName || detectedVault;
        physicalNotes = (await storage.readDesktopNotesForApp()) || [];
        folders = await window.electronAPI.listVaultFolders().catch(() => []);
      } else {
        if (!apiConfig.endpoint.trim() || !apiConfig.apiKey.trim()) {
          throw new Error("Configure o endpoint e a chave do Obsidian Local REST API antes de sincronizar no modo web.");
        }
        const verification = await api.probeObsidianConnection(apiConfig);
        if (!verification.success) throw new Error(verification.message);
        detectedVault = verification.detectedVaultName || detectedVault;
        physicalNotes = await api.syncWebObsidianNotes(apiConfig);
        folders = Array.from(new Set(physicalNotes.map((note) => note.folder).filter(Boolean)));
      }

      publishObsidianSnapshot(physicalNotes, folders);
      const syncedAt = new Date().toISOString();
      updateAndSaveApiConfig((previous) => ({
        ...previous,
        connectionStatus: "connected",
        errorMessage: undefined,
        lastSyncTime: syncedAt,
        vaultName: detectedVault,
      }));
      await storage.logAudit({
        action: "VAULT_SYNCED",
        entityType: "VAULT",
        entityId: detectedVault,
        details: `${physicalNotes.length} fonte(s) reconciliada(s) com o Vault físico em ${syncedAt}.`,
      });
      showToast("success", "Base atualizada", `${physicalNotes.length} fonte(s) disponíveis para o fluxo de marketing.`);
    } catch (error: any) {
      showToast("warning", "Falha ao atualizar a Base", error?.message || "Não foi possível ler o Vault.");
      if (!window.electronAPI) setIsSettingsOpen(true);
    } finally {
      setIsSyncing(false);
    }
  }, [apiConfig, isSyncing, showToast, updateAndSaveApiConfig]);

  const handleTestConnection = useCallback(
    async (config: ObsidianApiConfig) => {
      const result = await api.testObsidianConnection({
        endpoint: config.endpoint,
        apiKey: config.apiKey,
      });
      updateAndSaveApiConfig((previous) => ({
        ...previous,
        ...config,
        connectionStatus: result.success ? "connected" : "disconnected",
        errorMessage: result.success ? undefined : result.message,
        vaultName: result.detectedVaultName || config.vaultName || previous.vaultName || "MarketingVault",
      }));
      return result;
    },
    [updateAndSaveApiConfig],
  );

  const handleExtractTasksFromVault = useCallback(async (): Promise<number> => {
    const extracted = extractAllTasksFromNotes(notes);
    if (!extracted.length) return 0;

    let added = 0;
    setTasks((current) => {
      const signatures = new Set(
        current.map((task) => `${task.title.trim().toLocaleLowerCase("pt-BR")}::${task.obsidianFilePath || ""}`),
      );
      const fresh = extracted.filter((task) => {
        const signature = `${task.title.trim().toLocaleLowerCase("pt-BR")}::${task.obsidianFilePath || ""}`;
        if (signatures.has(signature)) return false;
        signatures.add(signature);
        added += 1;
        return true;
      });
      return fresh.length ? [...fresh, ...current] : current;
    });
    return added;
  }, [notes, setTasks]);

  const handlePushNoteToVault = useCallback(
    async (note: ObsidianNote) => {
      setIsPushingToVault(true);
      try {
        const result = await api.pushNoteToObsidian(apiConfig, note.path, note.content, note.frontmatter);
        if (!result?.success) throw new Error(result?.message || "O Vault não confirmou a gravação.");
        showToast("success", "Nota gravada", note.path);
      } catch (error: any) {
        showToast("warning", "Falha ao gravar nota", error?.message || "A alteração não foi confirmada no Vault.");
      } finally {
        setIsPushingToVault(false);
      }
    },
    [apiConfig, showToast],
  );

  const handleToggleTaskStatus = useCallback((taskId: string) => {
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;
        const status = task.status === "done" ? "todo" : "done";
        const check = status === "done" ? "x" : " ";
        const taskString = task.obsidianTaskString || `- [ ] ${task.title}`;
        return {
          ...task,
          status,
          obsidianTaskString: taskString.match(/\[[ xX]\]/)
            ? taskString.replace(/\[[ xX]\]/, `[${check}]`)
            : `- [${check}] ${task.title}`,
          completedAt: status === "done" ? new Date().toISOString() : undefined,
        };
      }),
    );
  }, [setTasks]);

  const handleExportVault = useCallback(() => {
    const sanitizedApiConfig: Record<string, unknown> = { ...apiConfig };
    delete sanitizedApiConfig.apiKey;
    delete sanitizedApiConfig.geminiApiKey;
    delete sanitizedApiConfig.openaiApiKey;

    const payload = JSON.stringify(
      {
        formatVersion: 2,
        version: APP_VERSION,
        exportedAt: new Date().toISOString(),
        notes,
        campaigns,
        tasks,
        ideas,
        scripts,
        postHistory,
        learnings,
        engineMode,
        apiConfig: sanitizedApiConfig,
      },
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nisti-marketing-backup-v${APP_VERSION}-${localDateKey()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("success", "Backup exportado", "O backup foi criado sem credenciais.");
  }, [apiConfig, campaigns, engineMode, ideas, learnings, notes, postHistory, scripts, showToast, tasks]);

  const handleImportVault = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = parseWorkspaceImport(JSON.parse(String(event.target?.result || "{}")));
        setNotes(parsed.notes as ObsidianNote[]);
        setCampaigns(parsed.campaigns as MarketingCampaign[]);
        setTasks(parsed.tasks as MarketingTask[]);
        if (parsed.ideas) setIdeas(parsed.ideas as IdeaItem[]);
        if (parsed.scripts) setScripts(parsed.scripts as CreativeScript[]);
        if (parsed.postHistory) setPostHistory(parsed.postHistory as PostHistoryItem[]);
        if (parsed.learnings) setLearnings(parsed.learnings as LearningInsight[]);
        if (parsed.engineMode) setEngineMode(parsed.engineMode as EngineMode);
        showToast("success", "Backup restaurado", "Estado operacional restaurado sem importar segredos.");
      } catch (error) {
        console.warn("Workspace import rejected:", error);
        showToast("warning", "Importação rejeitada", "O arquivo não corresponde ao schema suportado.");
      }
    };
    reader.readAsText(file);
  }, [setCampaigns, setEngineMode, setIdeas, setLearnings, setNotes, setPostHistory, setScripts, setTasks, showToast]);

  const handleClearAllData = useCallback(async () => {
    await storage.factoryResetAll();
    setNotes([]);
    setCampaigns([]);
    setTasks([]);
    setIdeas([]);
    setScripts([]);
    setPostHistory([]);
    setLearnings([]);
    setEngineMode("local");
    setSelectedNote(null);
    setActiveTab("vault");
    setApiConfig(DEFAULT_API_CONFIG);
    showToast("info", "Reset concluído", "O estado local foi limpo. O conteúdo físico do Vault não foi apagado.");
  }, [setCampaigns, setEngineMode, setIdeas, setLearnings, setNotes, setPostHistory, setScripts, setTasks, showToast]);

  const showPlanningSubTabs = isPlanningSubnavigationView(activeTab);

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-text-primary flex flex-col lg:flex-row font-sans selection:bg-purple-500/30 selection:text-purple-200">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`p-4 rounded-xl shadow-xl border flex items-start gap-3 max-w-sm ${
              toastMessage.type === "success"
                ? "bg-stone-900 text-white border-emerald-500/50"
                : toastMessage.type === "warning"
                  ? "bg-amber-950 text-amber-100 border-amber-500"
                  : "bg-stone-800 text-white border-stone-600"
            }`}
          >
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : toastMessage.type === "warning" ? (
              <Bell className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
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
          onSyncNow={() => void handleSyncNow()}
          isSyncing={isSyncing}
          tasks={tasks}
          onQuickNewCampaign={() => setActiveTab("campaigns")}
          onQuickNewTask={() => setIsTaskModalOpen(true)}
          onQuickNewNote={() => {
            if (!api.isObsidianSessionVerified()) {
              showToast("warning", "Base não disponível", "Selecione ou reconecte o Vault antes de criar uma nota documental.");
              setIsSettingsOpen(true);
              return;
            }
            setIsNoteModalOpen(true);
          }}
          onQuickNewIdea={() => setActiveTab("content")}
          hasApiKey={Boolean(apiConfig.apiKey.trim())}
          engineMode={engineMode}
          onToggleEngineMode={setEngineMode}
        />

        {showPlanningSubTabs && <SubTabs activeTab={activeTab} setActiveTab={setActiveTab} />}

        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col min-h-0 overflow-hidden">
          {activeTab === "dashboard" && (
            <DashboardView
              notes={notes}
              campaigns={campaigns}
              tasks={tasks}
              apiConfig={apiConfig}
              onNavigateTab={setActiveTab}
              onToggleTaskStatus={handleToggleTaskStatus}
              onOpenSetupWizard={() => setIsSettingsOpen(true)}
            />
          )}

          {activeTab === "vault" && (
            <VaultView
              notes={notes}
              selectedNote={selectedNote}
              onSelectNote={setSelectedNote}
              onUpdateNote={(updated) => {
                setNotes((current) => current.map((note) => note.path === updated.path ? updated : note));
                setSelectedNote(updated);
              }}
              onOpenAddSource={() => setActiveTab("knowledge")}
              onExtractTasksFromNote={() => {}}
              onGenerateCampaignFromNote={(note) => {
                setSelectedNote(note);
                setActiveTab("campaigns");
              }}
              onPushNoteToObsidianApi={(note) => void handlePushNoteToVault(note)}
              apiConfig={apiConfig}
              isExtractingTasks={false}
              isPushingToApi={isPushingToVault}
            />
          )}

          {activeTab === "knowledge" && (
            <AddKnowledgeView
              notes={notes}
              onAddNote={(note) => {
                setNotes((current) => [note, ...current.filter((item) => item.path !== note.path)]);
                setSelectedNote(note);
              }}
              apiConfig={apiConfig}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onSelectNote={setSelectedNote}
              engineMode={engineMode}
            />
          )}

          {activeTab === "content" && (
            <ContentView
              ideas={ideas}
              scripts={scripts}
              notes={notes}
              onAddIdea={(idea) => setIdeas((current) => [idea, ...current.filter((item) => item.id !== idea.id)])}
              onAddScript={(script) => setScripts((current) => [script, ...current.filter((item) => item.id !== script.id)])}
              onSaveToVault={async (content, folder, title) => {
                if (!window.electronAPI?.commitKnowledge) {
                  showToast("warning", "Runtime desktop necessário", "A gravação documental direta exige o aplicativo desktop.");
                  return;
                }
                const result = await window.electronAPI.commitKnowledge({ folder, title, content });
                if (!result?.success) {
                  showToast("warning", "Falha ao salvar", result?.error || "O Vault não confirmou a gravação.");
                  return;
                }
                showToast("success", "Conteúdo salvo", result.noteRelativePath || `${folder}/${title}.md`);
                await handleSyncNow();
              }}
              engineMode={engineMode}
            />
          )}

          {activeTab === "campaigns" && (
            <CampaignsView
              campaigns={campaigns}
              notes={notes}
              apiConfig={apiConfig}
              engineMode={engineMode}
            />
          )}

          {activeTab === "editorial" && (
            <EditorialCalendarView
              tasks={tasks}
              onTasksChange={setTasks}
              scripts={scripts}
            />
          )}

          {activeTab === "tasks" && (
            <TasksAutomationView
              tasks={tasks}
              automationRules={[]}
              onToggleTaskStatus={handleToggleTaskStatus}
              onUpdateTask={(updated) => setTasks((current) => current.map((task) => task.id === updated.id ? updated : task))}
              onDeleteTask={(taskId) => setTasks((current) => current.filter((task) => task.id !== taskId))}
              onOpenNewTaskModal={() => setIsTaskModalOpen(true)}
              onExtractTasksFromVault={handleExtractTasksFromVault}
              onToggleRule={() => {}}
              onRunRuleNow={async () => {}}
              onSyncDailyNote={async () => false}
              apiConfig={apiConfig}
              isSyncingDaily={false}
              initialSection="tasks"
            />
          )}

          {activeTab === "automations" && (
            <TasksAutomationView
              tasks={tasks}
              automationRules={[]}
              onToggleTaskStatus={handleToggleTaskStatus}
              onUpdateTask={(updated) => setTasks((current) => current.map((task) => task.id === updated.id ? updated : task))}
              onDeleteTask={(taskId) => setTasks((current) => current.filter((task) => task.id !== taskId))}
              onOpenNewTaskModal={() => setIsTaskModalOpen(true)}
              onToggleRule={() => {}}
              onRunRuleNow={async () => {}}
              onSyncDailyNote={async () => false}
              apiConfig={apiConfig}
              isSyncingDaily={false}
              initialSection="automations"
            />
          )}

          {activeTab === "routine" && (
            <RoutineIntelligenceView
              postHistory={postHistory}
              learnings={learnings}
              apiConfig={apiConfig}
              engineMode={engineMode}
              notes={notes}
              onAddPostHistory={(result) => {
                const item: PostHistoryItem = { ...result, id: `post-${Date.now()}` };
                setPostHistory((current) => [item, ...current]);
              }}
              onAddLearning={(learning) => {
                const item: LearningInsight = { ...learning, id: `learn-${Date.now()}` };
                setLearnings((current) => [item, ...current]);
              }}
              onUpdateLearning={(id, update) => setLearnings((current) => current.map((item) => item.id === id ? { ...item, ...update } : item))}
              onDeleteLearning={(id) => setLearnings((current) => current.filter((item) => item.id !== id))}
              showToast={showToast}
            />
          )}
        </main>
      </div>

      <ObsidianApiSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={apiConfig}
        onSaveConfig={(config) => {
          updateAndSaveApiConfig(config);
          showToast("success", "Configurações salvas", "As configurações locais foram atualizadas.");
        }}
        onTestConnection={handleTestConnection}
        onExportVault={handleExportVault}
        onImportVault={handleImportVault}
        onClearAllData={handleClearAllData}
      />

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSaveTask={(task) => {
          setTasks((current) => [task, ...current]);
          showToast("success", "Tarefa criada", "A tarefa foi registrada localmente em Execução.");
        }}
        notes={notes}
      />

      <NoteModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        onSaveNote={(note) => {
          setNotes((current) => [note, ...current.filter((item) => item.path !== note.path)]);
          setSelectedNote(note);
          setActiveTab("vault");
          showToast("success", "Nota criada", `Documento confirmado em ${note.path}.`);
        }}
        existingFolders={existingFolders}
      />
    </div>
  );
}
