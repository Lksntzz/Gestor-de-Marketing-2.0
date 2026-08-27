import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  FileText,
  Layers,
  Loader2,
  Plus,
  Save,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import type {
  EngineMode,
  MarketingCampaign,
  MarketingTask,
  ObsidianApiConfig,
  ObsidianNote,
  PostHistoryItem,
} from "../types";
import { api } from "../services/api";
import { APP_STATE_KEYS } from "../services/storage/StorageManager";
import { AppStateSchemas } from "../domain/appStateSchemas";
import { usePersistentState } from "../hooks/usePersistentState";
import { generateLocalCampaign } from "../utils/localEngine";
import { localDateKey } from "../utils/reliability";
import {
  buildResultsSnapshot,
  campaignResultSummary,
  deriveCampaignEpistemicStatus,
  GroundedCampaign,
  GroundedResult,
  normalizeSuggestedTasks,
  noteEpistemicStatus,
} from "../utils/resultsIntelligence";

interface CampaignsViewProps {
  campaigns: MarketingCampaign[];
  notes: ObsidianNote[];
  onGenerateCampaign: (params: {
    campaignName: string;
    objective: string;
    channels: string[];
    audience: string;
    tone: string;
    selectedNotePaths: string[];
    customInstructions?: string;
  }) => Promise<void>;
  isGenerating: boolean;
  onSaveCampaignToObsidian: (campaign: MarketingCampaign) => void;
  onImportCampaignTasks: (campaign: MarketingCampaign) => void;
  apiConfig: ObsidianApiConfig;
  engineMode?: EngineMode;
  onToggleEngineMode?: (mode: EngineMode) => void;
}

const CHANNELS = ["Instagram", "WhatsApp", "Email", "TikTok / Reels", "LinkedIn", "Blog"];
const FORMATS: PostHistoryItem["format"][] = [
  "carrossel",
  "reels_video",
  "artigo_blog",
  "newsletter",
  "thread_post",
];

type ResultMetricKey = keyof PostHistoryItem["metrics"];

const RESULT_METRICS: Array<{ key: ResultMetricKey; label: string; step?: string }> = [
  { key: "impressions", label: "Impressões" },
  { key: "reach", label: "Alcance" },
  { key: "likes", label: "Curtidas" },
  { key: "comments", label: "Comentários" },
  { key: "shares", label: "Compartilhamentos" },
  { key: "saves", label: "Salvamentos" },
  { key: "clicksOrLeads", label: "Cliques / Leads" },
  { key: "ctrPercent", label: "CTR (%)", step: "0.01" },
  { key: "conversionRatePercent", label: "Conversão (%)", step: "0.01" },
];

const EMPTY_METRICS: Record<ResultMetricKey, string> = {
  impressions: "",
  reach: "",
  likes: "",
  comments: "",
  shares: "",
  saves: "",
  clicksOrLeads: "",
  ctrPercent: "",
  conversionRatePercent: "",
};

function statusLabel(status: MarketingCampaign["status"]): string {
  if (status === "draft") return "Rascunho";
  if (status === "scheduled") return "Agendada";
  if (status === "active") return "Ativa";
  return "Concluída";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatPercent(value: number | null): string {
  return value === null ? "Sem dado" : `${value.toFixed(2)}%`;
}

function titleFromPath(path: string): string {
  return path.split("/").pop()?.replace(/\.md$/i, "") || path;
}

function weekdayFromDate(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const label = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export const CampaignsView: React.FC<CampaignsViewProps> = (props) => {
  const {
    campaigns = [],
    notes = [],
    apiConfig,
    engineMode = "local",
    onToggleEngineMode,
  } = props;

  const [campaignStore, setCampaignStore] = usePersistentState<MarketingCampaign[]>(
    APP_STATE_KEYS.CAMPAIGNS,
    campaigns,
    AppStateSchemas.campaigns
  );
  const [taskStore, setTaskStore] = usePersistentState<MarketingTask[]>(
    APP_STATE_KEYS.TASKS,
    [],
    AppStateSchemas.tasks
  );
  const [postHistory, setPostHistory] = usePersistentState<PostHistoryItem[]>(
    APP_STATE_KEYS.POST_HISTORY,
    [],
    AppStateSchemas.postHistory
  );

  const liveCampaigns = campaignStore as GroundedCampaign[];
  const groundedHistory = postHistory as GroundedResult[];
  const snapshot = useMemo(() => buildResultsSnapshot(postHistory), [postHistory]);

  const [mode, setMode] = useState<"results" | "campaigns" | "new">("results");
  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState("");
  const [objective, setObjective] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [selectedNotePaths, setSelectedNotePaths] = useState<string[]>([]);
  const [customInstructions, setCustomInstructions] = useState("");
  const [noteSearch, setNoteSearch] = useState("");
  const [isGeneratingGuidelines, setIsGeneratingGuidelines] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [savingCampaignId, setSavingCampaignId] = useState<string | null>(null);
  const [generatedCampaignId, setGeneratedCampaignId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "warning" | "info"; text: string } | null>(null);

  const [isResultFormOpen, setIsResultFormOpen] = useState(false);
  const [resultCampaignId, setResultCampaignId] = useState("");
  const [resultTitle, setResultTitle] = useState("");
  const [resultChannel, setResultChannel] = useState("");
  const [resultFormat, setResultFormat] = useState<PostHistoryItem["format"] | "">("");
  const [resultDate, setResultDate] = useState("");
  const [resultTime, setResultTime] = useState("");
  const [resultNiche, setResultNiche] = useState("");
  const [resultEmotion, setResultEmotion] = useState("");
  const [resultHook, setResultHook] = useState("");
  const [resultEvidence, setResultEvidence] = useState("");
  const [resultScore, setResultScore] = useState("");
  const [resultLearning, setResultLearning] = useState("");
  const [resultWorked, setResultWorked] = useState("");
  const [resultAvoid, setResultAvoid] = useState("");
  const [resultMetrics, setResultMetrics] = useState<Record<ResultMetricKey, string>>({ ...EMPTY_METRICS });

  const filteredNotes = useMemo(() => {
    const q = noteSearch.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((note) =>
      `${note.title} ${note.folder} ${note.tags.join(" ")}`.toLowerCase().includes(q)
    );
  }, [noteSearch, notes]);

  const selectedNotes = useMemo(
    () => notes.filter((note) => selectedNotePaths.includes(note.path)),
    [notes, selectedNotePaths]
  );

  const generatedCampaign = useMemo(
    () => liveCampaigns.find((campaign) => campaign.id === generatedCampaignId) || null,
    [liveCampaigns, generatedCampaignId]
  );

  const canContinue = (() => {
    if (step === 1) return Boolean(campaignName.trim() && objective.trim());
    if (step === 2) return selectedNotePaths.length > 0;
    if (step === 3) return Boolean(audience.trim() && tone.trim() && channels.length > 0);
    return true;
  })();

  const toggleNote = (path: string) => {
    setSelectedNotePaths((current) =>
      current.includes(path) ? current.filter((item) => item !== path) : [...current, path]
    );
  };

  const toggleChannel = (channel: string) => {
    setChannels((current) =>
      current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]
    );
  };

  const resetCampaignForm = () => {
    setStep(1);
    setCampaignName("");
    setObjective("");
    setAudience("");
    setTone("");
    setChannels([]);
    setSelectedNotePaths([]);
    setCustomInstructions("");
    setGeneratedCampaignId(null);
  };

  const generateGuidelines = async () => {
    if (!campaignName.trim() || !objective.trim()) return;
    setIsGeneratingGuidelines(true);
    try {
      const response = await api.generateGuidelines({
        campaignName: campaignName.trim(),
        objective: objective.trim(),
        engineMode,
      });
      const guidelines = response?.data?.guidelines;
      if (typeof guidelines === "string" && guidelines.trim()) {
        setCustomInstructions(guidelines.trim());
        setNotice({ type: "info", text: "Diretrizes sugeridas. Revise antes de gerar; elas não transformam informação ausente em fato." });
      }
    } catch (error: any) {
      setNotice({ type: "warning", text: error?.message || "Não foi possível sugerir diretrizes." });
    } finally {
      setIsGeneratingGuidelines(false);
    }
  };

  const generateCampaignDraft = async () => {
    if (!canContinue || step !== 4) return;
    setIsGeneratingDraft(true);
    setNotice(null);

    try {
      const matchedNotes = notes.filter((note) => selectedNotePaths.includes(note.path));
      let data: any;
      let usedEngine = engineMode === "local" ? "Motor Local Grounded (0 tokens)" : "Gemini";
      let wasFallback = false;

      if (engineMode === "local") {
        data = generateLocalCampaign({
          campaignName: campaignName.trim(),
          objective: objective.trim(),
          channels,
          audience: audience.trim(),
          tone: tone.trim(),
          contextNotesList: matchedNotes,
          customInstructions: customInstructions.trim() || undefined,
        });
        usedEngine = data.usedEngine || usedEngine;
      } else {
        const contextNotes = matchedNotes
          .map((note) => {
            const editorial = String(note.frontmatter?.status || "PENDENTE");
            const epistemic = noteEpistemicStatus(note);
            return [
              `--- FONTE: ${note.title} ---`,
              `Caminho: ${note.path}`,
              `Status editorial: ${editorial}`,
              `Status epistemológico: ${epistemic}`,
              note.content,
            ].join("\n");
          })
          .join("\n\n");

        try {
          const response = await api.generateCampaign({
            campaignName: campaignName.trim(),
            objective: objective.trim(),
            channels,
            audience: audience.trim(),
            tone: tone.trim(),
            contextNotes,
            customInstructions: customInstructions.trim() || undefined,
            engineMode,
          });
          if (!response?.success || !response?.data) throw new Error("A IA não retornou um rascunho válido.");
          data = response.data;
          usedEngine = response.usedModel || "Gemini";
          wasFallback = Boolean(response.wasFallback);
        } catch (error) {
          console.warn("Campaign AI unavailable, using grounded local engine:", error);
          data = generateLocalCampaign({
            campaignName: campaignName.trim(),
            objective: objective.trim(),
            channels,
            audience: audience.trim(),
            tone: tone.trim(),
            contextNotesList: matchedNotes,
            customInstructions: customInstructions.trim() || undefined,
          });
          usedEngine = data.usedEngine || "Motor Local Grounded (fallback)";
          wasFallback = true;
        }
      }

      const campaignId = `camp-${Date.now()}`;
      const outputNotePath = `04_Campanhas/${campaignName.trim()}.md`;
      const epistemicStatus =
        data?.epistemicStatus === "HIPÓTESE" || data?.epistemicStatus === "PENDENTE"
          ? data.epistemicStatus
          : deriveCampaignEpistemicStatus(notes, selectedNotePaths);
      const suggestedTasks = normalizeSuggestedTasks(data?.tasks, campaignId, outputNotePath);
      const generatedMarkdown = String(data?.obsidianMarkdownNote || data?.obsidianNoteMarkdown || "").trim();

      const draft: GroundedCampaign = {
        id: campaignId,
        title: campaignName.trim(),
        objective: objective.trim(),
        targetAudience: audience.trim(),
        tone: tone.trim(),
        status: "draft",
        channels: channels.slice(),
        channelsContent: Array.isArray(data?.channelsContent) ? data.channelsContent : [],
        linkedNotePaths: selectedNotePaths.slice(),
        obsidianOutputNotePath: outputNotePath,
        summary: String(data?.summary || "").trim(),
        strategy: String(data?.strategy || "").trim(),
        startDate: "",
        endDate: "",
        createdDate: localDateKey(),
        epistemicStatus,
        usedEngine,
        wasFallback,
        generatedMarkdown,
        suggestedTasks,
      };

      setCampaignStore((current) => [draft, ...current.filter((item) => item.id !== draft.id)]);
      setGeneratedCampaignId(draft.id);
      setStep(5);
      setNotice({
        type: "success",
        text: `Rascunho gerado como ${epistemicStatus}. Nada foi salvo no Obsidian, agendado ou importado para Execução automaticamente.`,
      });
    } catch (error: any) {
      setNotice({ type: "warning", text: error?.message || "Falha ao gerar o rascunho da campanha." });
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const saveCampaignToObsidian = async (campaign: GroundedCampaign) => {
    if (apiConfig.connectionStatus !== "connected") {
      setNotice({ type: "warning", text: "Conecte e valide o Obsidian antes de gravar a campanha no Vault." });
      return;
    }
    if (!campaign.generatedMarkdown?.trim() || !campaign.obsidianOutputNotePath) {
      setNotice({ type: "warning", text: "Este rascunho não possui Markdown rastreável para gravar no Obsidian." });
      return;
    }

    setSavingCampaignId(campaign.id);
    try {
      const result = await api.pushNoteToObsidian(
        apiConfig,
        campaign.obsidianOutputNotePath,
        campaign.generatedMarkdown
      );
      if (!result?.success) throw new Error(result?.message || "O Obsidian não confirmou a gravação.");

      const savedAt = new Date().toISOString();
      setCampaignStore((current) =>
        current.map((item) => item.id === campaign.id ? ({ ...item, savedToObsidianAt: savedAt } as GroundedCampaign) : item)
      );
      setNotice({ type: "success", text: `Rascunho confirmado no Vault em ${campaign.obsidianOutputNotePath}. O status da campanha não foi alterado automaticamente.` });
    } catch (error: any) {
      setNotice({ type: "warning", text: error?.message || "Falha ao gravar a campanha no Obsidian." });
    } finally {
      setSavingCampaignId(null);
    }
  };

  const importCampaignTasks = (campaign: GroundedCampaign) => {
    const suggested = campaign.suggestedTasks || [];
    if (suggested.length === 0) {
      setNotice({ type: "info", text: "Nenhuma tarefa com prioridade explícita foi sugerida para esta campanha." });
      return;
    }

    let imported = 0;
    setTaskStore((current) => {
      const existingKeys = new Set(current.map((task) => `${task.linkedCampaignId || ""}::${task.title.toLowerCase()}`));
      const fresh = suggested.filter((task) => {
        const key = `${campaign.id}::${task.title.toLowerCase()}`;
        if (existingKeys.has(key)) return false;
        existingKeys.add(key);
        imported += 1;
        return true;
      });
      return fresh.length ? [...fresh, ...current] : current;
    });

    setNotice({
      type: imported > 0 ? "success" : "info",
      text: imported > 0
        ? `${imported} tarefa(s) importada(s) para Execução sem inventar prazo, horário ou lembrete.`
        : "As tarefas sugeridas desta campanha já estavam em Execução.",
    });
  };

  const updateCampaignStatus = (campaignId: string, status: MarketingCampaign["status"]) => {
    setCampaignStore((current) => current.map((campaign) => campaign.id === campaignId ? { ...campaign, status } : campaign));
    setNotice({ type: "info", text: `Status alterado manualmente para ${statusLabel(status)}.` });
  };

  const resetResultForm = () => {
    setResultCampaignId("");
    setResultTitle("");
    setResultChannel("");
    setResultFormat("");
    setResultDate("");
    setResultTime("");
    setResultNiche("");
    setResultEmotion("");
    setResultHook("");
    setResultEvidence("");
    setResultScore("");
    setResultLearning("");
    setResultWorked("");
    setResultAvoid("");
    setResultMetrics({ ...EMPTY_METRICS });
  };

  const saveResult = (event: React.FormEvent) => {
    event.preventDefault();
    const linkedCampaign = liveCampaigns.find((campaign) => campaign.id === resultCampaignId);
    const metricsReady = RESULT_METRICS.every(({ key }) => {
      const raw = resultMetrics[key].trim();
      const value = Number(raw);
      return raw !== "" && Number.isFinite(value) && value >= 0;
    });
    const score = Number(resultScore);

    if (
      !linkedCampaign ||
      !resultTitle.trim() ||
      !resultChannel.trim() ||
      !resultFormat ||
      !resultDate ||
      !resultTime ||
      !resultNiche.trim() ||
      !resultEmotion.trim() ||
      !resultHook.trim() ||
      !resultEvidence.trim() ||
      !metricsReady ||
      resultScore.trim() === "" ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100
    ) {
      setNotice({
        type: "warning",
        text: "Para evitar dados simulados, preencha campanha, publicação, classificação, fonte de evidência, todas as métricas e o score registrado. Nenhum campo quantitativo será completado automaticamente.",
      });
      return;
    }

    const metrics = Object.fromEntries(
      RESULT_METRICS.map(({ key }) => [key, Number(resultMetrics[key])])
    ) as PostHistoryItem["metrics"];

    const recorded: GroundedResult = {
      id: `result-${Date.now()}`,
      title: resultTitle.trim(),
      channel: resultChannel.trim(),
      format: resultFormat,
      publishedAt: `${resultDate}T${resultTime}:00`,
      dayOfWeek: weekdayFromDate(resultDate),
      timeSlot: resultTime,
      targetNiche: resultNiche.trim() as PostHistoryItem["targetNiche"],
      emotionalDriver: resultEmotion.trim() as PostHistoryItem["emotionalDriver"],
      hookUsed: resultHook.trim(),
      metrics,
      performanceScore: score,
      learnings: resultLearning.trim(),
      whatWorked: resultWorked.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
      whatToAvoid: resultAvoid.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
      linkedObsidianNote: linkedCampaign.obsidianOutputNotePath,
      linkedCampaignId: linkedCampaign.id,
      evidenceSource: resultEvidence.trim(),
    };

    setPostHistory((current) => [recorded, ...current]);
    setIsResultFormOpen(false);
    resetResultForm();
    setNotice({ type: "success", text: "Resultado registrado com evidência explícita. As métricas passam a alimentar os indicadores reais do sistema." });
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 font-sans">
      <header className="flex shrink-0 flex-col gap-3 border-b border-outline-border pb-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-fixed-dim">Nisti Marketing</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-text-primary">Resultados & Campanhas</h1>
          <p className="mt-1 text-xs text-text-secondary">Campanhas permanecem rascunho até decisão humana. Resultados usam somente métricas registradas com evidência.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-outline-border bg-surface-container-low p-1">
            {([
              ["results", "Resultados"],
              ["campaigns", `Campanhas (${liveCampaigns.length})`],
              ["new", "Nova campanha"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === id ? "bg-primary-container text-white" : "text-text-secondary"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {onToggleEngineMode && (
            <button
              onClick={() => onToggleEngineMode(engineMode === "local" ? "gemini" : "local")}
              className="rounded-xl border border-outline-border bg-surface-card px-3 py-2 text-xs font-bold text-text-primary"
            >
              {engineMode === "local" ? "Motor Local" : "Gemini"}
            </button>
          )}
        </div>
      </header>

      {notice && (
        <div className={`shrink-0 rounded-xl border px-4 py-3 text-xs ${notice.type === "success" ? "border-success-sober/30 bg-success-sober/10 text-success-sober" : notice.type === "warning" ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-outline-border bg-surface-container-low text-text-secondary"}`}>
          {notice.text}
        </div>
      )}

      {mode === "results" && (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <div className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard label="Publicações registradas" value={formatNumber(snapshot.publications)} />
            <MetricCard label="Alcance registrado" value={formatNumber(snapshot.reach)} />
            <MetricCard label="Cliques / Leads" value={formatNumber(snapshot.clicksOrLeads)} />
            <MetricCard label="CTR médio registrado" value={formatPercent(snapshot.averageCtr)} />
          </div>

          <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
            <section className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-2xl border border-outline-border bg-surface-card p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black text-text-primary">Histórico de resultados</h2>
                  <p className="mt-1 text-[11px] text-text-secondary">Sem projeções, tendências artificiais ou sincronização presumida.</p>
                </div>
                <button
                  onClick={() => setIsResultFormOpen((value) => !value)}
                  disabled={liveCampaigns.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" /> Registrar resultado
                </button>
              </div>

              {isResultFormOpen && (
                <form onSubmit={saveResult} className="mb-5 space-y-4 rounded-xl border border-outline-border bg-surface-container-low p-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <Field label="Campanha vinculada">
                      <select value={resultCampaignId} onChange={(e) => setResultCampaignId(e.target.value)} className="field-input">
                        <option value="">Selecione explicitamente</option>
                        {liveCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}
                      </select>
                    </Field>
                    <Field label="Publicação / peça">
                      <input value={resultTitle} onChange={(e) => setResultTitle(e.target.value)} className="field-input" placeholder="Título real publicado" />
                    </Field>
                    <Field label="Canal">
                      <input value={resultChannel} onChange={(e) => setResultChannel(e.target.value)} className="field-input" placeholder="Canal registrado" />
                    </Field>
                    <Field label="Formato">
                      <select value={resultFormat} onChange={(e) => setResultFormat(e.target.value as PostHistoryItem["format"] | "")} className="field-input">
                        <option value="">Selecione</option>
                        {FORMATS.map((format) => <option key={format} value={format}>{format}</option>)}
                      </select>
                    </Field>
                    <Field label="Data publicada">
                      <input type="date" value={resultDate} onChange={(e) => setResultDate(e.target.value)} className="field-input" />
                    </Field>
                    <Field label="Hora publicada">
                      <input type="time" value={resultTime} onChange={(e) => setResultTime(e.target.value)} className="field-input" />
                    </Field>
                    <Field label="Nicho / segmento registrado">
                      <input value={resultNiche} onChange={(e) => setResultNiche(e.target.value)} className="field-input" placeholder="Sem classificação automática" />
                    </Field>
                    <Field label="Gatilho / abordagem registrada">
                      <input value={resultEmotion} onChange={(e) => setResultEmotion(e.target.value)} className="field-input" placeholder="Informe o usado" />
                    </Field>
                    <Field label="Score registrado (0–100)">
                      <input type="number" min="0" max="100" step="0.01" value={resultScore} onChange={(e) => setResultScore(e.target.value)} className="field-input" placeholder="Sem cálculo automático" />
                    </Field>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Gancho realmente usado">
                      <textarea rows={2} value={resultHook} onChange={(e) => setResultHook(e.target.value)} className="field-input resize-none" />
                    </Field>
                    <Field label="Fonte da evidência">
                      <textarea rows={2} value={resultEvidence} onChange={(e) => setResultEvidence(e.target.value)} className="field-input resize-none" placeholder="Ex.: Meta Insights, relatório exportado, URL ou captura identificável" />
                    </Field>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {RESULT_METRICS.map(({ key, label, step }) => (
                      <Field key={key} label={label}>
                        <input
                          type="number"
                          min="0"
                          step={step || "1"}
                          value={resultMetrics[key]}
                          onChange={(e) => setResultMetrics((current) => ({ ...current, [key]: e.target.value }))}
                          className="field-input"
                          placeholder="Obrigatório — valor real"
                        />
                      </Field>
                    ))}
                  </div>

                  <div className="grid gap-3 lg:grid-cols-3">
                    <Field label="Aprendizado observado">
                      <textarea rows={3} value={resultLearning} onChange={(e) => setResultLearning(e.target.value)} className="field-input resize-none" placeholder="Opcional; escreva somente o que a evidência suporta" />
                    </Field>
                    <Field label="O que funcionou — 1 por linha">
                      <textarea rows={3} value={resultWorked} onChange={(e) => setResultWorked(e.target.value)} className="field-input resize-none" />
                    </Field>
                    <Field label="O que evitar — 1 por linha">
                      <textarea rows={3} value={resultAvoid} onChange={(e) => setResultAvoid(e.target.value)} className="field-input resize-none" />
                    </Field>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => { setIsResultFormOpen(false); resetResultForm(); }} className="rounded-lg border border-outline-border px-3 py-2 text-xs font-bold text-text-secondary">Cancelar</button>
                    <button type="submit" className="rounded-lg bg-primary-container px-4 py-2 text-xs font-bold text-white">Salvar resultado real</button>
                  </div>
                </form>
              )}

              {groundedHistory.length === 0 ? (
                <EmptyState icon={BarChart3} title="Nenhum resultado registrado" text="O Nisti não cria métricas automaticamente. Registre dados somente quando houver evidência de publicação e medição." />
              ) : (
                <div className="space-y-3">
                  {groundedHistory.map((item) => {
                    const linked = liveCampaigns.find((campaign) => campaign.id === item.linkedCampaignId);
                    return (
                      <article key={item.id} className="rounded-xl border border-outline-border bg-surface-container-low p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-text-primary">{item.title}</p>
                              {linked && <span className="rounded bg-primary-container/10 px-2 py-0.5 text-[10px] font-bold text-primary-fixed-dim">{linked.title}</span>}
                            </div>
                            <p className="mt-1 text-[11px] text-text-secondary">{item.channel} • {item.publishedAt}</p>
                            {item.evidenceSource && <p className="mt-2 text-[11px] text-text-secondary">Evidência: {item.evidenceSource}</p>}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-right">
                            <SmallMetric label="Alcance" value={formatNumber(Number(item.metrics?.reach || 0))} />
                            <SmallMetric label="Leads" value={formatNumber(Number(item.metrics?.clicksOrLeads || 0))} />
                            <SmallMetric label="CTR" value={`${Number(item.metrics?.ctrPercent || 0).toFixed(2)}%`} />
                          </div>
                        </div>
                        {item.learnings && <p className="mt-3 border-t border-outline-border pt-3 text-xs leading-5 text-text-secondary">{item.learnings}</p>}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <aside className="hidden w-80 shrink-0 overflow-y-auto rounded-2xl border border-outline-border bg-surface-card p-4 2xl:block">
              <h2 className="text-sm font-black text-text-primary">Resultados por campanha</h2>
              <p className="mt-1 text-[11px] text-text-secondary">Somente publicações vinculadas explicitamente.</p>
              <div className="mt-4 space-y-3">
                {liveCampaigns.length === 0 ? (
                  <p className="text-xs text-text-secondary">Nenhuma campanha registrada.</p>
                ) : liveCampaigns.map((campaign) => {
                  const result = campaignResultSummary(campaign, postHistory);
                  return (
                    <div key={campaign.id} className="rounded-xl border border-outline-border bg-surface-container-low p-3">
                      <p className="text-xs font-bold text-text-primary">{campaign.title}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <SmallMetric label="Publicações" value={String(result.publications)} />
                        <SmallMetric label="Alcance" value={formatNumber(result.reach)} />
                        <SmallMetric label="Leads" value={formatNumber(result.clicksOrLeads)} />
                        <SmallMetric label="CTR" value={formatPercent(result.averageCtr)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>
          </div>
        </div>
      )}

      {mode === "campaigns" && (
        <section className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-outline-border bg-surface-card p-4">
          {liveCampaigns.length === 0 ? (
            <EmptyState icon={Layers} title="Nenhuma campanha registrada" text="Crie um rascunho a partir de fontes selecionadas. Nada será ativado ou agendado automaticamente." />
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {liveCampaigns.map((campaign) => {
                const result = campaignResultSummary(campaign, postHistory);
                const suggestedCount = campaign.suggestedTasks?.length || 0;
                return (
                  <article key={campaign.id} className="rounded-xl border border-outline-border bg-surface-container-low p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded bg-surface-card px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary">{statusLabel(campaign.status)}</span>
                          <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${campaign.epistemicStatus === "HIPÓTESE" ? "bg-amber-500/10 text-amber-300" : "bg-error-sober/10 text-error-sober"}`}>{campaign.epistemicStatus || "PENDENTE"}</span>
                        </div>
                        <h2 className="mt-2 text-base font-bold text-text-primary">{campaign.title}</h2>
                        <p className="mt-2 text-xs leading-5 text-text-secondary">{campaign.summary || "Sem resumo registrado."}</p>
                      </div>
                      <Target className="h-5 w-5 shrink-0 text-primary-fixed-dim" />
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-outline-border bg-surface-card p-3">
                      <SmallMetric label="Fontes" value={String(campaign.linkedNotePaths.length)} />
                      <SmallMetric label="Tarefas sugeridas" value={String(suggestedCount)} />
                      <SmallMetric label="Resultados" value={String(result.publications)} />
                    </div>

                    <div className="mt-3 text-[11px] text-text-secondary">
                      <p>Motor: {campaign.usedEngine || "Não registrado"}{campaign.wasFallback ? " • fallback seguro" : ""}</p>
                      <p className="mt-1">Agenda: {campaign.startDate || campaign.endDate ? `${campaign.startDate || "sem início"} → ${campaign.endDate || "sem término"}` : "não definida"}</p>
                      <p className="mt-1">Obsidian: {campaign.savedToObsidianAt ? `gravado em ${campaign.savedToObsidianAt}` : "ainda não confirmado"}</p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => saveCampaignToObsidian(campaign)} disabled={savingCampaignId === campaign.id || !campaign.generatedMarkdown} className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
                        {savingCampaignId === campaign.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar no Obsidian
                      </button>
                      <button onClick={() => importCampaignTasks(campaign)} disabled={suggestedCount === 0} className="rounded-lg border border-outline-border px-3 py-2 text-xs font-bold text-text-primary disabled:opacity-40">Importar tarefas</button>
                      <select value={campaign.status} onChange={(e) => updateCampaignStatus(campaign.id, e.target.value as MarketingCampaign["status"])} className="rounded-lg border border-outline-border bg-surface-card px-3 py-2 text-xs font-bold text-text-primary">
                        <option value="draft">Rascunho</option>
                        <option value="scheduled">Agendada</option>
                        <option value="active">Ativa</option>
                        <option value="completed">Concluída</option>
                      </select>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {mode === "new" && (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="grid shrink-0 grid-cols-5 gap-2">
            {["Definição", "Base", "Canais", "Revisão", "Rascunho"].map((label, index) => {
              const number = index + 1;
              const active = number === step;
              const done = number < step;
              return (
                <button key={label} disabled={number > step} onClick={() => number <= step && setStep(number)} className={`rounded-xl border px-2 py-2 text-[10px] font-bold uppercase tracking-wider ${active ? "border-primary-container bg-primary-container/15 text-primary-fixed-dim" : done ? "border-success-sober/40 bg-success-sober/10 text-success-sober" : "border-outline-border bg-surface-container-low text-text-secondary"}`}>
                  {done ? <Check className="mx-auto mb-1 h-3.5 w-3.5" /> : <span className="mb-1 block">{number}</span>}
                  {label}
                </button>
              );
            })}
          </div>

          <section className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-outline-border bg-surface-card p-5">
            {step === 1 && (
              <div className="mx-auto max-w-3xl space-y-5">
                <Field label="Nome da campanha"><input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Nome informado" className="field-input mt-2" /></Field>
                <Field label="Objetivo"><textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Resultado de marketing esperado, sem preencher métricas automaticamente" rows={5} className="field-input mt-2 resize-none" /></Field>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                  <input value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)} placeholder="Buscar no cofre conectado" className="field-input w-full py-3 pl-10 pr-4" />
                </div>
                {notes.length === 0 ? (
                  <EmptyState icon={FileText} title="Nenhuma fonte sincronizada" text="A geração fundamentada exige ao menos uma fonte selecionada do Obsidian." />
                ) : (
                  <div className="grid gap-2 lg:grid-cols-2">
                    {filteredNotes.map((note) => {
                      const selected = selectedNotePaths.includes(note.path);
                      const epistemic = noteEpistemicStatus(note);
                      return (
                        <button key={note.id} onClick={() => toggleNote(note.path)} className={`rounded-xl border p-3 text-left ${selected ? "border-primary-container bg-primary-container/10" : "border-outline-border bg-surface-container-low"}`}>
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? "border-primary-container bg-primary-container text-white" : "border-outline-border"}`}>{selected && <Check className="h-3.5 w-3.5" />}</div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-xs font-bold text-text-primary">{note.title}</p>
                                <span className={`text-[9px] font-bold ${epistemic === "CONFIRMADO" ? "text-success-sober" : epistemic === "HIPÓTESE" ? "text-amber-300" : "text-error-sober"}`}>{epistemic}</span>
                              </div>
                              <p className="mt-1 truncate text-[10px] text-text-secondary">{note.path}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="mx-auto max-w-3xl space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Público"><input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Quem queremos alcançar?" className="field-input mt-2" /></Field>
                  <Field label="Tom"><input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Tom explicitamente escolhido" className="field-input mt-2" /></Field>
                </div>
                <Field label="Canais">
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CHANNELS.map((channel) => <button key={channel} onClick={() => toggleChannel(channel)} className={`rounded-lg border px-3 py-2 text-xs font-bold ${channels.includes(channel) ? "border-primary-container bg-primary-container/15 text-primary-fixed-dim" : "border-outline-border text-text-secondary"}`}>{channel}</button>)}
                  </div>
                </Field>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Diretrizes adicionais</label>
                    <button onClick={generateGuidelines} disabled={isGeneratingGuidelines || !campaignName.trim() || !objective.trim()} className="inline-flex items-center gap-2 rounded-lg border border-outline-border px-3 py-2 text-xs font-bold text-text-primary disabled:opacity-50">
                      {isGeneratingGuidelines ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Sugerir diretrizes gerais
                    </button>
                  </div>
                  <textarea value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder="Opcional. Revise qualquer sugestão antes de gerar." rows={6} className="field-input mt-2 resize-none" />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="mx-auto max-w-3xl space-y-4">
                <h2 className="text-lg font-black text-text-primary">Revisão antes de gerar</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  <ReviewItem label="Campanha" value={campaignName} />
                  <ReviewItem label="Objetivo" value={objective} />
                  <ReviewItem label="Público" value={audience} />
                  <ReviewItem label="Tom" value={tone} />
                  <ReviewItem label="Canais" value={channels.join(", ")} />
                  <ReviewItem label="Fontes" value={`${selectedNotes.length} selecionada(s) • ${selectedNotes.filter((note) => noteEpistemicStatus(note) === "CONFIRMADO").length} confirmada(s)`} />
                </div>
                <div className="rounded-xl border border-outline-border bg-surface-container-low p-4 text-xs leading-5 text-text-secondary">
                  Gerar cria somente um rascunho local. Não ativa campanha, não define datas, não grava no Obsidian e não adiciona tarefas automaticamente.
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="mx-auto max-w-3xl">
                {generatedCampaign ? (
                  <div className="space-y-4">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-primary-fixed-dim">Rascunho gerado</span>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">{generatedCampaign.epistemicStatus || "PENDENTE"}</span>
                      </div>
                      <h2 className="mt-1 text-xl font-black text-text-primary">{generatedCampaign.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-text-secondary">{generatedCampaign.summary}</p>
                    </div>
                    <div className="rounded-xl border border-outline-border bg-surface-container-low p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Estratégia</p>
                      <p className="mt-2 text-sm leading-6 text-text-primary">{generatedCampaign.strategy}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <ReviewItem label="Motor" value={`${generatedCampaign.usedEngine || "Não registrado"}${generatedCampaign.wasFallback ? " • fallback" : ""}`} />
                      <ReviewItem label="Tarefas sugeridas" value={String(generatedCampaign.suggestedTasks?.length || 0)} />
                      <ReviewItem label="Agenda" value="Não definida" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => saveCampaignToObsidian(generatedCampaign)} disabled={savingCampaignId === generatedCampaign.id || !generatedCampaign.generatedMarkdown} className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"><Save className="h-3.5 w-3.5" /> Salvar no Obsidian</button>
                      <button onClick={() => importCampaignTasks(generatedCampaign)} disabled={!generatedCampaign.suggestedTasks?.length} className="rounded-lg border border-outline-border px-4 py-2.5 text-xs font-bold text-text-primary disabled:opacity-40">Importar tarefas</button>
                    </div>
                  </div>
                ) : <p className="text-sm text-text-secondary">Nenhum rascunho disponível.</p>}
              </div>
            )}
          </section>

          <footer className="flex shrink-0 items-center justify-between gap-3">
            <button onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1 || isGeneratingDraft} className="inline-flex items-center gap-2 rounded-xl border border-outline-border px-4 py-2.5 text-xs font-bold text-text-primary disabled:opacity-40"><ArrowLeft className="h-4 w-4" /> Voltar</button>
            {step < 4 && <button onClick={() => canContinue && setStep((current) => Math.min(4, current + 1))} disabled={!canContinue} className="inline-flex items-center gap-2 rounded-xl bg-primary-container px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">Continuar <ArrowRight className="h-4 w-4" /></button>}
            {step === 4 && <button onClick={generateCampaignDraft} disabled={isGeneratingDraft || !canContinue} className="inline-flex items-center gap-2 rounded-xl bg-primary-container px-5 py-2.5 text-xs font-bold text-white disabled:opacity-40">{isGeneratingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar rascunho</button>}
            {step === 5 && <button onClick={resetCampaignForm} className="rounded-xl border border-outline-border px-4 py-2.5 text-xs font-bold text-text-primary">Nova campanha</button>}
          </footer>
        </div>
      )}

      {apiConfig.connectionStatus !== "connected" && (
        <div className="shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          Obsidian desconectado: consultar resultados e preparar rascunhos continua possível, mas a gravação no Vault permanece bloqueada até a conexão ser validada.
        </div>
      )}

      <style>{`.field-input{width:100%;border-radius:.75rem;border:1px solid var(--color-outline-border);background:var(--color-surface-container-lowest);padding:.7rem .85rem;font-size:.75rem;color:var(--color-text-primary);outline:none}.field-input:focus{border-color:var(--color-primary-container)}`}</style>
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-outline-border bg-surface-card p-4">
    <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{label}</p>
    <p className="mt-2 text-2xl font-black text-text-primary">{value}</p>
  </div>
);

const SmallMetric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[9px] font-bold uppercase tracking-wider text-text-secondary">{label}</p>
    <p className="mt-1 text-xs font-black text-text-primary">{value}</p>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{label}</span>
    {children}
  </label>
);

const ReviewItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-outline-border bg-surface-container-low p-4">
    <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{label}</p>
    <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-5 text-text-primary">{value || "Pendente"}</p>
  </div>
);

const EmptyState: React.FC<{ icon: React.ComponentType<{ className?: string }>; title: string; text: string }> = ({ icon: Icon, title, text }) => (
  <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-outline-border p-8 text-center">
    <Icon className="mb-3 h-8 w-8 text-text-secondary" />
    <h2 className="text-sm font-bold text-text-primary">{title}</h2>
    <p className="mt-1 max-w-lg text-xs leading-5 text-text-secondary">{text}</p>
  </div>
);
