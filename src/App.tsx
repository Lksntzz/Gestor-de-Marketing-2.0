import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Navbar } from "./components/Navbar";
import { DashboardView } from "./components/DashboardView";
import { VaultView } from "./components/VaultView";
import { CampaignsView } from "./components/CampaignsView";
import { TasksAutomationView } from "./components/TasksAutomationView";
import { RoutineIntelligenceView } from "./components/RoutineIntelligenceView";
import { AddKnowledgeView } from "./components/AddKnowledgeView";
import { ObsidianApiSettingsModal } from "./components/ObsidianApiSettingsModal";
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
  EmotionalDriverKey,
  NicheSegment,
  NicheSegmentKey,
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
import { formatToObsidianTask, parseObsidianTaskString } from "./utils/obsidianUri";
import {
  generateLocalCampaign,
  extractLocalTasksFromNote,
  analyzeLocalVault,
} from "./utils/localEngine";
import confetti from "canvas-confetti";
import { Bell, CheckCircle2, AlertTriangle, Sparkles, Zap } from "lucide-react";

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "vault" | "campaigns" | "tasks" | "automations" | "routine" | "knowledge"
  >("dashboard");

  // Engine Mode State: "local" (0 tokens, deterministic, offline) vs "ai" (Gemini)
  const [engineMode, setEngineMode] = useState<EngineMode>(() => {
    const saved = localStorage.getItem("obsidian_engine_mode");
    return (saved as EngineMode) || "local";
  });

  // Core Data State (persisted to localStorage)
  const [notes, setNotes] = useState<ObsidianNote[]>(() => {
    const saved = localStorage.getItem("obsidian_marketing_notes");
    return saved ? JSON.parse(saved) : DEFAULT_OBSIDIAN_NOTES;
  });

  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>(() => {
    const saved = localStorage.getItem("obsidian_marketing_campaigns");
    return saved ? JSON.parse(saved) : DEFAULT_CAMPAIGNS;
  });

  const [tasks, setTasks] = useState<MarketingTask[]>(() => {
    const saved = localStorage.getItem("obsidian_marketing_tasks");
    return saved ? JSON.parse(saved) : DEFAULT_TASKS;
  });

  const [automationRules, setAutomationRules] = useState<AutomationRule[]>(() => {
    const saved = localStorage.getItem("obsidian_marketing_rules");
    return saved ? JSON.parse(saved) : DEFAULT_AUTOMATION_RULES;
  });

  const [ideas, setIdeas] = useState<IdeaItem[]>(() => {
    const saved = localStorage.getItem("obsidian_marketing_ideas");
    return saved ? JSON.parse(saved) : DEFAULT_IDEAS;
  });

  const [scripts, setScripts] = useState<CreativeScript[]>(() => {
    const saved = localStorage.getItem("obsidian_marketing_scripts");
    return saved ? JSON.parse(saved) : DEFAULT_SCRIPTS;
  });

  const [visuals, setVisuals] = useState<VisualAsset[]>(() => {
    const saved = localStorage.getItem("obsidian_marketing_visuals");
    return saved ? JSON.parse(saved) : DEFAULT_VISUALS;
  });

  const [emotionalDrivers, setEmotionalDrivers] = useState<EmotionalDriver[]>(() => {
    const saved = localStorage.getItem("obsidian_emotional_drivers");
    return saved ? JSON.parse(saved) : DEFAULT_EMOTIONAL_DRIVERS;
  });

  const [niches, setNiches] = useState<NicheSegment[]>(() => {
    const saved = localStorage.getItem("obsidian_niches");
    return saved ? JSON.parse(saved) : DEFAULT_NICHES;
  });

  const [postHistory, setPostHistory] = useState<PostHistoryItem[]>(() => {
    const saved = localStorage.getItem("obsidian_post_history");
    return saved ? JSON.parse(saved) : DEFAULT_POST_HISTORY;
  });

  const [learnings, setLearnings] = useState<LearningInsight[]>(() => {
    const saved = localStorage.getItem("obsidian_learnings");
    return saved ? JSON.parse(saved) : DEFAULT_LEARNING_INSIGHTS;
  });

  const [weeklyRoutine, setWeeklyRoutine] = useState<DailyRoutineSlot[]>(() => {
    const saved = localStorage.getItem("obsidian_weekly_routine");
    return saved ? JSON.parse(saved) : DEFAULT_WEEKLY_ROUTINE;
  });

  const [apiConfig, setApiConfig] = useState<ObsidianApiConfig>(() => {
    const saved = localStorage.getItem("obsidian_api_config");
    return saved
      ? JSON.parse(saved)
      : {
          endpoint: "http://127.0.0.1:27124",
          apiKey: "obsidian_marketing_token",
          vaultName: "MarketingVault",
          useHttps: false,
          autoSync: true,
          syncIntervalSeconds: 60,
          connectionStatus: "disconnected",
          allowSelfSignedCerts: true,
        };
  });

  // Selected Note & Audit State
  const [selectedNote, setSelectedNote] = useState<ObsidianNote | null>(notes[0] || null);
  const [auditInsight, setAuditInsight] = useState<VaultAuditInsight | null>(null);

  // Modals & UI Controls
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  // Loading States
  const [isGeneratingCampaign, setIsGeneratingCampaign] = useState(false);
  const [isAuditingVault, setIsAuditingVault] = useState(false);
  const [isExtractingTasks, setIsExtractingTasks] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPushingToApi, setIsPushingToApi] = useState(false);
  const [isSyncingDaily, setIsSyncingDaily] = useState(false);

  // Toast / Alert Notification
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "info" | "warning";
    title: string;
    text: string;
  } | null>(null);

  const showToast = (type: "success" | "info" | "warning", title: string, text: string) => {
    setToastMessage({ type, title, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem("obsidian_marketing_notes", JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem("obsidian_marketing_campaigns", JSON.stringify(campaigns));
  }, [campaigns]);

  useEffect(() => {
    localStorage.setItem("obsidian_marketing_tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem("obsidian_marketing_rules", JSON.stringify(automationRules));
  }, [automationRules]);

  useEffect(() => {
    localStorage.setItem("obsidian_marketing_ideas", JSON.stringify(ideas));
  }, [ideas]);

  useEffect(() => {
    localStorage.setItem("obsidian_marketing_scripts", JSON.stringify(scripts));
  }, [scripts]);

  useEffect(() => {
    localStorage.setItem("obsidian_marketing_visuals", JSON.stringify(visuals));
  }, [visuals]);

  useEffect(() => {
    localStorage.setItem("obsidian_emotional_drivers", JSON.stringify(emotionalDrivers));
  }, [emotionalDrivers]);

  useEffect(() => {
    localStorage.setItem("obsidian_niches", JSON.stringify(niches));
  }, [niches]);

  useEffect(() => {
    localStorage.setItem("obsidian_post_history", JSON.stringify(postHistory));
  }, [postHistory]);

  useEffect(() => {
    localStorage.setItem("obsidian_learnings", JSON.stringify(learnings));
  }, [learnings]);

  useEffect(() => {
    localStorage.setItem("obsidian_weekly_routine", JSON.stringify(weeklyRoutine));
  }, [weeklyRoutine]);

  useEffect(() => {
    localStorage.setItem("obsidian_api_config", JSON.stringify(apiConfig));
  }, [apiConfig]);

  useEffect(() => {
    localStorage.setItem("obsidian_engine_mode", engineMode);
  }, [engineMode]);

  // Global CTRL+K Shortcut for Universal Search
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

  // Initial Health Check & Initial Vault Audit
  useEffect(() => {
    api.checkHealth().then((h) => {
      if (!h.hasApiKey) {
        console.log("Backend executando. Motor Local inteligente ativo por padrão.");
      }
    });

    // Auto-audit on first load if empty
    if (!auditInsight && notes.length > 0) {
      runVaultAudit();
    }
  }, []);

  // Check reminders alarm loop (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentDate = now.toISOString().split("T")[0];
      const currentHours = String(now.getHours()).padStart(2, "0");
      const currentMins = String(now.getMinutes()).padStart(2, "0");
      const currentTime = `${currentHours}:${currentMins}`;

      tasks.forEach((t) => {
        if (
          t.isReminderActive &&
          t.status !== "done" &&
          t.reminderDate === currentDate &&
          t.reminderTime === currentTime
        ) {
          showToast(
            "warning",
            "⏰ Lembrete Obsidian Ativado!",
            `Tarefa: ${t.title} (${t.channel || "Geral"})`
          );
        }
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [tasks]);

  // Existing Folders list
  const existingFolders = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => set.add(n.folder || "Raiz"));
    return Array.from(set).sort();
  }, [notes]);

  // ==========================================
  // HANDLERS & ACTIONS
  // ==========================================

  // 1. Audit Vault with Local Heuristic Engine or AI
  const runVaultAudit = useCallback(async () => {
    setIsAuditingVault(true);
    try {
      if (engineMode === "local") {
        // Deterministic, offline heuristic audit (0 tokens)
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

  // 2. Generate Campaign with Local Heuristic Engine or AI
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
        // 100% deterministic local generation with copywriting frameworks (0 tokens)
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
        // Hybrid mode with Gemini API
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
      const outputNotePath = `03 - Campanhas/${params.campaignName}.md`;

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
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date(Date.now() + 86400000 * 20).toISOString().split("T")[0],
        createdDate: new Date().toISOString().split("T")[0],
      };

      // Create the note in vault
      if (d.obsidianMarkdownNote) {
        const newNote: ObsidianNote = {
          id: `note-${Date.now()}`,
          path: outputNotePath,
          title: params.campaignName,
          folder: "03 - Campanhas",
          content: d.obsidianMarkdownNote,
          frontmatter: {
            title: params.campaignName,
            tags: ["campanha", "marketing-local", ...(params.channels || []).map((c) => (c || "").toLowerCase().replace(/\s+/g, "-")).filter(Boolean)],
            status: "Ativo",
            publish_date: new Date().toISOString().split("T")[0],
            channel: params.channels.join(", "),
          },
          tags: ["campanha", "marketing-local"],
          wikilinks: params.selectedNotePaths.map((p) => p.split("/").pop()?.replace(".md", "") || ""),
          lastModified: new Date().toISOString().replace("T", " ").slice(0, 16),
          syncedWithApi: false,
        };
        setNotes((prev) => [newNote, ...prev]);
      }

      // Add generated tasks to Task Board
      if (d.tasks && Array.isArray(d.tasks)) {
        const generatedTasks: MarketingTask[] = d.tasks.map((t: any, idx: number) => ({
          id: `task-${Date.now()}-${idx}`,
          title: t.title,
          description: t.description || "",
          channel: t.channel || "Geral",
          priority: t.priority || "medium",
          status: "todo",
          dueDate: t.dueDate || new Date().toISOString().split("T")[0],
          dueTime: t.dueTime || "14:00",
          reminderDate: t.dueDate || new Date().toISOString().split("T")[0],
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

  // 3. Extract Tasks from any Obsidian Note with Local Heuristic Engine or AI
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
        const newTasks: MarketingTask[] = tasksData.extractedTasks.map(
          (t: any, idx: number) => ({
            id: `task-${Date.now()}-${idx}`,
            title: t.title,
            channel: t.channel || "Geral",
            priority: t.priority || "medium",
            status: "todo",
            dueDate: t.dueDate || new Date().toISOString().split("T")[0],
            dueTime: t.dueTime || "12:00",
            reminderDate: t.reminderDate || t.dueDate,
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

  // 4. Save/Push Note to Obsidian via Local REST API
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
    } catch (err: any) {
      showToast(
        "info",
        "Nota Salva Localmente",
        "Clique em 'Abrir no App' para carregar no Obsidian Desktop via URI scheme."
      );
    } finally {
      setIsPushingToApi(false);
    }
  };

  // 5. Sync Tasks directly to Obsidian Daily Note
  const handleSyncDailyNote = async () => {
    setIsSyncingDaily(true);
    try {
      const pendingTaskList = tasks
        .filter((t) => t.status !== "done")
        .map((t) => t.obsidianTaskString)
        .join("\n");

      const today = new Date().toISOString().split("T")[0];
      const dailyPath = `Daily Notes/${today}.md`;

      // Update local daily note or create one
      const existingDaily = notes.find((n) => n.path === dailyPath);
      if (existingDaily) {
        const updatedContent = `${existingDaily.content}\n\n## 📋 Tarefas Adicionadas pelo Marketing Engine\n${pendingTaskList}`;
        setNotes((prev) =>
          prev.map((n) => (n.id === existingDaily.id ? { ...n, content: updatedContent } : n))
        );
      } else {
        const newDaily: ObsidianNote = {
          id: `note-${Date.now()}`,
          path: dailyPath,
          title: `Daily Note: ${today}`,
          folder: "Daily Notes",
          content: `# 📅 Daily Note: ${today}\n\n## 📋 Tarefas Sincronizadas do Gestor de Marketing\n${pendingTaskList}`,
          frontmatter: { title: `Daily Note: ${today}`, tags: ["daily-note", "marketing"] },
          tags: ["daily-note", "marketing"],
          wikilinks: [],
          lastModified: new Date().toISOString().replace("T", " ").slice(0, 16),
        };
        setNotes((prev) => [newDaily, ...prev]);
      }

      // Try pushing to API if available
      await api.appendToDailyNote(apiConfig, pendingTaskList).catch(() => {});

      showToast(
        "success",
        "Daily Note Atualizada!",
        `Tarefas e lembretes inseridos na nota do dia ${today}.`
      );
      confetti({ particleCount: 30, spread: 50 });
    } finally {
      setIsSyncingDaily(false);
    }
  };

  // 5.1 Sync Weekly Routine to Daily Notes & Tasks
  const handleSyncRoutineToDailyNotes = async () => {
    setIsSyncingDaily(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const dailyPath = `Daily Notes/${today}.md`;

      const routineTasksText = weeklyRoutine
        .map(
          (slot) =>
            `- [ ] Publicar ${slot.dayOfWeek}: ${slot.focusTheme} 📅 ${today} ⏰ ${slot.optimalTime} #marketing/rotina #${slot.primaryEmotion} #${slot.primaryNiche}`
        )
        .join("\n");

      // Add to tasks state
      const newTasks: MarketingTask[] = weeklyRoutine.map((slot, index) => ({
        id: `routine-task-${Date.now()}-${index}`,
        title: `Publicar ${slot.dayOfWeek}: ${slot.focusTheme}`,
        description: `Formato: ${slot.recommendedFormat.toUpperCase()} | Emoção: ${slot.primaryEmotion} | Nicho: ${slot.primaryNiche}\nHook: "${slot.suggestedHookPattern}"`,
        channel: slot.recommendedFormat === "newsletter" ? "Email Newsletter" : slot.recommendedFormat === "carrossel" ? "LinkedIn" : "Instagram",
        priority: "high",
        status: "todo",
        dueDate: today,
        dueTime: slot.optimalTime,
        reminderDate: today,
        reminderTime: slot.optimalTime,
        obsidianTaskString: `- [ ] Publicar ${slot.dayOfWeek}: ${slot.focusTheme} 📅 ${today} ⏰ ${slot.optimalTime} #marketing/rotina`,
        obsidianFilePath: dailyPath,
        tags: ["marketing-rotina", slot.primaryEmotion, slot.primaryNiche],
        isReminderActive: true,
      }));

      setTasks((prev) => [...newTasks, ...prev]);

      // Update or create daily note
      const existingDaily = notes.find((n) => n.path === dailyPath);
      if (existingDaily) {
        const updatedContent = `${existingDaily.content}\n\n## 🗓️ Rotina Semanal de Conteúdo (Gatilhos Emocionais & Nichos)\n${routineTasksText}`;
        setNotes((prev) =>
          prev.map((n) => (n.id === existingDaily.id ? { ...n, content: updatedContent } : n))
        );
      } else {
        const newDaily: ObsidianNote = {
          id: `note-${Date.now()}`,
          path: dailyPath,
          title: `Daily Note: ${today}`,
          folder: "Daily Notes",
          content: `# 📅 Daily Note: ${today}\n\n## 🗓️ Rotina Semanal de Conteúdo (Gatilhos Emocionais & Nichos)\n${routineTasksText}`,
          frontmatter: { title: `Daily Note: ${today}`, tags: ["daily-note", "marketing-rotina"] },
          tags: ["daily-note", "marketing-rotina"],
          wikilinks: [],
          lastModified: new Date().toISOString().replace("T", " ").slice(0, 16),
        };
        setNotes((prev) => [newDaily, ...prev]);
      }

      await api.appendToDailyNote(apiConfig, routineTasksText).catch(() => {});

      showToast(
        "success",
        "Rotina Sincronizada!",
        `${weeklyRoutine.length} slots de rotina com alarmes gravados na Daily Note (${today}).`
      );
      confetti({ particleCount: 40, spread: 60 });
    } finally {
      setIsSyncingDaily(false);
    }
  };

  // 6. Test Obsidian Connection
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

  // 7. Toggle Task Done Status
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

  // 8. Delete Task
  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    showToast("info", "Tarefa Removida", "A tarefa foi removida da lista.");
  };

  // 9. Automation Rule Toggle / Run
  const handleToggleRule = (ruleId: string) => {
    setAutomationRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleRunRuleNow = (ruleId: string) => {
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
    showToast("success", "Automação Executada!", "Regra de automação disparada com sucesso.");
    confetti({ particleCount: 25 });
  };

  // 10. Vault Export & Import
  const handleExportVault = () => {
    const dataStr = JSON.stringify({ notes, campaigns, tasks, apiConfig }, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `obsidian-marketing-vault-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportVault = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed.notes) setNotes(parsed.notes);
        if (parsed.campaigns) setCampaigns(parsed.campaigns);
        if (parsed.tasks) setTasks(parsed.tasks);
        showToast("success", "Cofre Importado!", "Sua base de conhecimento e tarefas foram restauradas.");
      } catch {
        showToast("warning", "Erro na Importação", "Arquivo JSON inválido.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-stone-100/40 text-stone-900 flex flex-col font-sans selection:bg-purple-200 selection:text-purple-900">
      {/* Toast Notification Alert */}
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

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        apiConfig={apiConfig}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSyncNow={() => {
          setIsSyncing(true);
          setTimeout(() => {
            setIsSyncing(false);
            showToast("success", "Sincronização Concluída", "Base de notas e tarefas atualizadas.");
          }, 800);
        }}
        isSyncing={isSyncing}
        onQuickNewCampaign={() => {
          setActiveTab("campaigns");
        }}
        onQuickNewTask={() => setIsTaskModalOpen(true)}
        onQuickNewNote={() => setIsNoteModalOpen(true)}
        hasApiKey={true}
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

      {/* Main Content Body */}
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
                if (note) handlePushNoteToObsidianApi(note);
              }
            }}
            onImportCampaignTasks={(camp) => {
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

      {/* Modals */}
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
