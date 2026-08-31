import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Layers,
  Lightbulb,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Share2,
  Sparkles,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";
import type { EditorialItem, LearningInsight, ObsidianApiConfig, ObsidianNote, PostHistoryItem } from "../types";
import { localDateKey } from "../utils/reliability";
import { NISTI_VAULT_ROOT } from "../services/obsidianKnowledgeAutomation";
import {
  buildLearningSnapshot,
  formatRecordedMetric,
} from "../utils/learningIntelligence";
import {
  computeChannelAnalytics,
  computeFormatAnalytics,
  exportLearningsToMarkdown,
  formatCanonicalLearningNote,
} from "../domain/learningLoop";
import {
  requestLearningSynthesis,
  type LearningSynthesisResponse,
} from "../services/learningLoopClient";

interface RoutineIntelligenceViewProps {
  postHistory: PostHistoryItem[];
  learnings: LearningInsight[];
  notes?: ObsidianNote[];
  apiConfig?: ObsidianApiConfig;
  engineMode?: string;
  onAddPostHistory: (result: Omit<PostHistoryItem, "id">) => void;
  onAddLearning: (learning: Omit<LearningInsight, "id">) => void;
  onUpdateLearning?: (learningId: string, updated: Partial<LearningInsight>) => void;
  onDeleteLearning?: (learningId: string) => void;
  showToast: (type: "success" | "warning" | "info", title: string, message: string) => void;
  [legacyProp: string]: unknown;
}

const FIELD_INPUT_CLASS = "w-full bg-black/20 border border-outline-border rounded-xl px-3 py-2.5 text-xs text-text-primary placeholder:text-text-secondary/70 focus:outline-none focus:border-pink-500/50";

type MetricDraft = {
  impressions: string;
  reach: string;
  saves: string;
  clicksOrLeads: string;
  ctrPercent: string;
  conversionRatePercent: string;
};

const EMPTY_METRICS: MetricDraft = {
  impressions: "",
  reach: "",
  saves: "",
  clicksOrLeads: "",
  ctrPercent: "",
  conversionRatePercent: "",
};

function formatPublishedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "Data não registrada";
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatResultMetric(value: unknown, suffix = ""): string {
  if (value === undefined || value === null || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(number)}${suffix}`;
}

function optionalMetric(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const number = Number(trimmed.replace(",", "."));
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function hasInvalidMetric(value: string): boolean {
  if (!value.trim()) return false;
  return optionalMetric(value) === undefined;
}

type SubTab = "overview" | "history" | "learnings" | "synthesis";

export const RoutineIntelligenceView: React.FC<RoutineIntelligenceViewProps> = ({
  postHistory = [],
  learnings = [],
  notes = [],
  apiConfig,
  engineMode = "hybrid",
  onAddPostHistory,
  onAddLearning,
  onUpdateLearning,
  onDeleteLearning,
  showToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("overview");
  const [isAddResultOpen, setIsAddResultOpen] = useState(false);
  const [publishedEditorialItems, setPublishedEditorialItems] = useState<EditorialItem[]>([]);
  const [resultEditorialItemId, setResultEditorialItemId] = useState("");
  const [resultTitle, setResultTitle] = useState("");
  const [resultChannel, setResultChannel] = useState("");
  const [resultFormat, setResultFormat] = useState("");
  const [resultPublishedAt, setResultPublishedAt] = useState("");
  const [resultEvidenceSource, setResultEvidenceSource] = useState("");
  const [resultMetrics, setResultMetrics] = useState<MetricDraft>(EMPTY_METRICS);

  const [isAddLearningOpen, setIsAddLearningOpen] = useState(false);
  const [learningTitle, setLearningTitle] = useState("");
  const [learningCategory, setLearningCategory] = useState<LearningInsight["category"]>("formato");
  const [learningVerdict, setLearningVerdict] = useState<LearningInsight["verdict"]>("EM_TESTE");
  const [learningRule, setLearningRule] = useState("");
  const [learningEvidence, setLearningEvidence] = useState("");
  const [learningAction, setLearningAction] = useState("");

  // AI Synthesis State
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisResult, setSynthesisResult] = useState<LearningSynthesisResponse | null>(null);
  const [synthesisFocus, setSynthesisFocus] = useState("");
  const [isSavingToVault, setIsSavingToVault] = useState(false);
  const [savingLearningId, setSavingLearningId] = useState<string | null>(null);

  const snapshot = useMemo(
    () => buildLearningSnapshot(postHistory, learnings),
    [postHistory, learnings],
  );

  const channelAnalytics = useMemo(
    () => computeChannelAnalytics(postHistory),
    [postHistory]
  );

  const formatAnalytics = useMemo(
    () => computeFormatAnalytics(postHistory),
    [postHistory]
  );

  useEffect(() => {
    if (!window.electronAPI?.editorialList) {
      setPublishedEditorialItems([]);
      return;
    }

    void window.electronAPI.editorialList()
      .then((items) => {
        setPublishedEditorialItems(
          (Array.isArray(items) ? items : []).filter((item) => item.status === "PUBLISHED"),
        );
      })
      .catch(() => setPublishedEditorialItems([]));
  }, [postHistory.length]);

  const resetResultForm = () => {
    setResultEditorialItemId("");
    setResultTitle("");
    setResultChannel("");
    setResultFormat("");
    setResultPublishedAt("");
    setResultEvidenceSource("");
    setResultMetrics(EMPTY_METRICS);
  };

  const selectPublishedItem = (editorialItemId: string) => {
    setResultEditorialItemId(editorialItemId);
    if (!editorialItemId) return;

    const item = publishedEditorialItems.find((candidate) => candidate.id === editorialItemId);
    if (!item) return;

    setResultTitle(item.title);
    setResultChannel(item.platform);
    setResultFormat(item.contentType);
  };

  const handleAddResult = (event: React.FormEvent) => {
    event.preventDefault();

    if (!resultTitle.trim() || !resultChannel.trim() || !resultFormat.trim() || !resultPublishedAt.trim()) {
      showToast(
        "warning",
        "Resultado incompleto",
        "Título, canal, formato e data real de publicação são obrigatórios.",
      );
      return;
    }

    const metricEntries = Object.entries(resultMetrics) as Array<[keyof MetricDraft, string]>;
    if (metricEntries.some(([, value]) => hasInvalidMetric(value))) {
      showToast(
        "warning",
        "Métrica inválida",
        "Métricas informadas devem ser números maiores ou iguais a zero. Deixe vazio quando não houver medição.",
      );
      return;
    }

    const metrics = Object.fromEntries(
      metricEntries.flatMap(([key, value]) => {
        const number = optionalMetric(value);
        return number === undefined ? [] : [[key, number]];
      }),
    ) as NonNullable<PostHistoryItem["metrics"]>;

    if (Object.keys(metrics).length === 0 && !resultEvidenceSource.trim()) {
      showToast(
        "warning",
        "Evidência ausente",
        "Registre ao menos uma métrica realmente medida ou uma referência de evidência.",
      );
      return;
    }

    onAddPostHistory({
      title: resultTitle.trim(),
      channel: resultChannel.trim(),
      format: resultFormat.trim(),
      publishedAt: resultPublishedAt.trim(),
      metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
      editorialItemId: resultEditorialItemId || undefined,
      evidenceSource: resultEvidenceSource.trim() || undefined,
    });

    resetResultForm();
    setIsAddResultOpen(false);
    showToast(
      "success",
      "Resultado registrado",
      "Somente os dados informados foram salvos; campos não medidos permaneceram ausentes.",
    );
  };

  const handleAddLearning = (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !learningTitle.trim()
      || !learningRule.trim()
      || !learningEvidence.trim()
      || !learningAction.trim()
    ) {
      showToast(
        "warning",
        "Aprendizado incompleto",
        "Título, regra, evidência e próxima ação são obrigatórios.",
      );
      return;
    }

    onAddLearning({
      title: learningTitle.trim(),
      category: learningCategory,
      verdict: learningVerdict,
      ruleOfThumb: learningRule.trim(),
      evidenceData: learningEvidence.trim(),
      suggestedAction: learningAction.trim(),
      dateCreated: localDateKey(),
    });

    setLearningTitle("");
    setLearningCategory("formato");
    setLearningVerdict("EM_TESTE");
    setLearningRule("");
    setLearningEvidence("");
    setLearningAction("");
    setIsAddLearningOpen(false);
    showToast(
      "success",
      "Aprendizado registrado",
      "A regra foi salva com evidência explícita e próxima ação.",
    );
  };

  const handleRunAiSynthesis = async () => {
    if (postHistory.length === 0 && learnings.length === 0) {
      showToast(
        "warning",
        "Sem dados suficientes",
        "Registre ao menos uma publicação ou hipótese para que a IA possa sintetizar aprendizados."
      );
      return;
    }

    setIsSynthesizing(true);
    try {
      const res = await requestLearningSynthesis({
        postHistory,
        existingLearnings: learnings,
        knowledgeNotes: notes,
        customFocus: synthesisFocus,
        engineMode,
        apiConfig,
      });
      setSynthesisResult(res);
      setActiveSubTab("synthesis");
      showToast("success", "Síntese Concluída", "Diagnóstico epistêmico e aprendizados gerados com sucesso.");
    } catch (err: any) {
      showToast("warning", "Aviso na Síntese", err?.message || "Não foi possível completar a síntese via IA.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleCopyMarkdownReport = async () => {
    const md = exportLearningsToMarkdown(learnings, postHistory);
    try {
      await navigator.clipboard.writeText(md);
      showToast("success", "Copiado", "Relatório completo em Markdown copiado para a área de transferência.");
    } catch {
      showToast("warning", "Erro", "Não foi possível copiar o relatório.");
    }
  };

  const handleSaveReportToVault = async () => {
    const md = exportLearningsToMarkdown(learnings, postHistory);
    const dateStr = new Date().toISOString().split("T")[0];
    const title = `Relatório de Performance - ${dateStr}`;

    setIsSavingToVault(true);
    try {
      if (window.electronAPI?.commitKnowledge) {
        await window.electronAPI.commitKnowledge({
          title,
          folder: `${NISTI_VAULT_ROOT}/08_Aprendizados`,
          content: md,
        });
        showToast("success", "Salvo no Vault", `Nota [[${title}]] criada na pasta ${NISTI_VAULT_ROOT}/08_Aprendizados/.`);
      } else {
        showToast("info", "Modo Web", "Relatório gerado. Abra no desktop para persistir no arquivo local.");
      }
    } catch (err: any) {
      showToast("warning", "Erro ao Salvar", err?.message || "Falha ao gravar no cofre.");
    } finally {
      setIsSavingToVault(false);
    }
  };

  const handlePromoteLearningToVault = async (learning: LearningInsight) => {
    setSavingLearningId(learning.id);
    const noteData = formatCanonicalLearningNote(learning);
    try {
      if (window.electronAPI?.commitKnowledge) {
        await window.electronAPI.commitKnowledge(noteData);
        showToast("success", "Regra Canônica Gravada", `Nota [[${noteData.title}]] salva na Base de Conhecimento.`);
      } else {
        showToast("info", "Modo Web", `Nota [[${noteData.title}]] formatada.`);
      }
    } catch (err: any) {
      showToast("warning", "Erro ao Salvar", err?.message || "Falha ao gravar nota canônica.");
    } finally {
      setSavingLearningId(null);
    }
  };

  const handleAdoptValidatedRule = (rule: {
    title: string;
    category: any;
    verdict: any;
    ruleOfThumb: string;
    evidenceData: string;
    suggestedAction: string;
  }) => {
    onAddLearning({
      title: rule.title,
      category: rule.category || "formato",
      verdict: rule.verdict === "CONFIRMADO" ? "CONFIRMADO" : "EM_TESTE",
      ruleOfThumb: rule.ruleOfThumb,
      evidenceData: rule.evidenceData,
      suggestedAction: rule.suggestedAction,
      dateCreated: localDateKey(),
    });
    showToast("success", "Regra Adotada", `"${rule.title}" incorporada à base de aprendizados.`);
  };

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-5 font-sans overflow-y-auto no-scrollbar pb-6">
      {/* Header */}
      <header className="shrink-0 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-outline-border">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-pink-500">
            <BookOpenCheck className="w-3.5 h-3.5" />
            Inteligência de Performance & Aprendizado Epistêmico
          </div>
          <h1 className="text-2xl font-black text-text-primary mt-1">Aprender & Resultados</h1>
          <p className="text-xs text-text-secondary mt-1 max-w-3xl leading-relaxed">
            Consolidação de dados reais, validação de hipóteses e retroalimentação canônica para o motor de IA da Nisti Print.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <button
            type="button"
            onClick={handleCopyMarkdownReport}
            className="px-3.5 py-2.5 rounded-xl border border-outline-border bg-surface-card hover:bg-surface-elevated text-text-primary text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Copiar relatório completo em Markdown"
          >
            <Copy className="w-3.5 h-3.5" />
            Copiar MD
          </button>

          <button
            type="button"
            disabled={isSavingToVault}
            onClick={handleSaveReportToVault}
            className="px-3.5 py-2.5 rounded-xl border border-outline-border bg-surface-card hover:bg-surface-elevated text-text-primary text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Salvar relatório na pasta 06_Metricas do Vault"
          >
            {isSavingToVault ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Salvar no Vault
          </button>

          <button
            type="button"
            disabled={isSynthesizing}
            onClick={handleRunAiSynthesis}
            className="px-3.5 py-2.5 rounded-xl border border-pink-500/40 bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {isSynthesizing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-400" /> : <BrainCircuit className="w-3.5 h-3.5 text-pink-400" />}
            {isSynthesizing ? "Sintetizando..." : "Síntese Epistêmica (IA)"}
          </button>

          <button
            type="button"
            onClick={() => setIsAddResultOpen(true)}
            className="px-3.5 py-2.5 rounded-xl border border-outline-border bg-surface-card hover:bg-surface-elevated text-text-primary text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Registrar resultado
          </button>

          <button
            type="button"
            onClick={() => setIsAddLearningOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova regra / hipótese
          </button>
        </div>
      </header>

      {/* Sub-Navigation */}
      <nav className="flex items-center gap-2 border-b border-outline-border pb-2 shrink-0">
        <button
          type="button"
          onClick={() => setActiveSubTab("overview")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
            activeSubTab === "overview"
              ? "bg-pink-500/20 text-pink-300 border border-pink-500/40"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Visão Geral & Canais
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("history")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
            activeSubTab === "history"
              ? "bg-pink-500/20 text-pink-300 border border-pink-500/40"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          Histórico ({postHistory.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("learnings")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
            activeSubTab === "learnings"
              ? "bg-pink-500/20 text-pink-300 border border-pink-500/40"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5" />
          Regras & Hipóteses ({learnings.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("synthesis")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
            activeSubTab === "synthesis"
              ? "bg-pink-500/20 text-pink-300 border border-pink-500/40"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Diagnóstico com IA {synthesisResult && "• Ativo"}
        </button>
      </nav>

      {/* KPI Global Banner */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 shrink-0">
        <MetricCard label="Registros Medidos" value={String(snapshot.recordedResults)} sub="Publicações" />
        <MetricCard label="Alcance Total" value={formatRecordedMetric(snapshot.reach)} sub="Pessoas" />
        <MetricCard label="Cliques / Leads" value={formatRecordedMetric(snapshot.clicksOrLeads)} sub="Conversões" />
        <MetricCard label="CTR Médio" value={formatRecordedMetric(snapshot.averageCtr, "%")} sub="Taxa de clique" />
        <MetricCard label="Conversão Média" value={formatRecordedMetric(snapshot.averageConversionRate, "%")} sub="Fechamento" />
      </section>

      {/* SUBTAB 1: OVERVIEW & CHANNELS */}
      {activeSubTab === "overview" && (
        <div className="space-y-6">
          {/* Desempenho por Canal */}
          <section className="bg-surface-card border border-outline-border rounded-xl p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-pink-400" />
                <div>
                  <h2 className="text-sm font-black text-text-primary">Desempenho por Canal de Divulgação</h2>
                  <p className="text-[10px] text-text-secondary">Comparação consolidada baseada estritamente nos dados reais.</p>
                </div>
              </div>
            </div>

            {channelAnalytics.length === 0 ? (
              <EmptyState
                title="Nenhum canal registrado ainda"
                description="Registre publicações com métricas reais para visualizar a comparação detalhada por canal."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {channelAnalytics.map((ch) => (
                  <article key={ch.channel} className="rounded-xl border border-outline-border bg-surface-container-low p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-black text-text-primary uppercase tracking-wider">{ch.channel}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-pink-500/10 text-pink-300 font-bold border border-pink-500/20">
                        {ch.totalPosts} {ch.totalPosts === 1 ? "post" : "posts"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-outline-border/60">
                      <SmallMetric label="Alcance" value={ch.totalReach !== null ? ch.totalReach.toLocaleString("pt-BR") : "—"} />
                      <SmallMetric label="Cliques / Leads" value={ch.totalClicksOrLeads !== null ? ch.totalClicksOrLeads.toLocaleString("pt-BR") : "—"} />
                      <SmallMetric label="CTR Médio" value={ch.averageCtr !== null ? `${ch.averageCtr.toFixed(1)}%` : "—"} />
                      <SmallMetric label="Conversão Média" value={ch.averageConversionRate !== null ? `${ch.averageConversionRate.toFixed(1)}%` : "—"} />
                    </div>

                    {ch.formatsUsed.length > 0 && (
                      <div className="text-[10px] text-text-secondary pt-1">
                        <span className="font-semibold text-text-primary/80">Formatos: </span>
                        {ch.formatsUsed.join(", ")}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Desempenho por Formato */}
          <section className="bg-surface-card border border-outline-border rounded-xl p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <div>
                  <h2 className="text-sm font-black text-text-primary">Eficácia por Formato de Conteúdo</h2>
                  <p className="text-[10px] text-text-secondary">Avalie se vídeos, carrosséis, artigos ou artes estáticas geram mais retorno.</p>
                </div>
              </div>
            </div>

            {formatAnalytics.length === 0 ? (
              <EmptyState
                title="Nenhum formato medido"
                description="Registre formatos em suas publicações para comparar eficácia."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {formatAnalytics.map((fmt) => (
                  <article key={fmt.format} className="rounded-xl border border-outline-border bg-surface-container-low p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-black text-text-primary capitalize">{fmt.format.replace(/_/g, " ")}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 font-bold border border-purple-500/20">
                        {fmt.totalPosts} {fmt.totalPosts === 1 ? "peça" : "peças"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-outline-border/60">
                      <SmallMetric label="Alcance" value={fmt.totalReach !== null ? fmt.totalReach.toLocaleString("pt-BR") : "—"} />
                      <SmallMetric label="Cliques / Leads" value={fmt.totalClicksOrLeads !== null ? fmt.totalClicksOrLeads.toLocaleString("pt-BR") : "—"} />
                      <SmallMetric label="CTR Médio" value={fmt.averageCtr !== null ? `${fmt.averageCtr.toFixed(1)}%` : "—"} />
                      <SmallMetric label="Conversão" value={fmt.averageConversionRate !== null ? `${fmt.averageConversionRate.toFixed(1)}%` : "—"} />
                    </div>

                    {fmt.channelsUsed.length > 0 && (
                      <div className="text-[10px] text-text-secondary pt-1">
                        <span className="font-semibold text-text-primary/80">Canais: </span>
                        {fmt.channelsUsed.join(", ")}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* SUBTAB 2: PUBLICATION HISTORY */}
      {activeSubTab === "history" && (
        <section className="bg-surface-card border border-outline-border rounded-xl p-5 min-h-[360px]">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-pink-400" />
              <div>
                <h2 className="text-sm font-black text-text-primary">Histórico de Publicações Reais</h2>
                <p className="text-[10px] text-text-secondary">Registro esparso: somente métricas informadas constam no sistema.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsAddResultOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          </div>

          {snapshot.latestResults.length === 0 ? (
            <EmptyState
              title="Nenhum resultado registrado"
              description="Registre uma publicação real e apenas as métricas que você efetivamente mediu."
            />
          ) : (
            <div className="space-y-3">
              {snapshot.latestResults.map((result) => (
                <article key={result.id} className="rounded-xl border border-outline-border bg-surface-container-low p-4 transition-colors hover:border-pink-500/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-xs font-black text-text-primary">{result.title}</h3>
                      <p className="text-[10px] text-text-secondary mt-1">
                        <span className="text-pink-400 font-bold">{result.channel}</span> · {result.format.replace(/_/g, " ")} · Publicado em {formatPublishedAt(result.publishedAt)}
                      </p>
                    </div>
                    {(result.editorialItemId || result.linkedObsidianNote || result.evidenceSource) && (
                      <span className="shrink-0 text-[9px] uppercase tracking-wider text-text-secondary flex items-center gap-1 bg-surface-card px-2 py-1 rounded-md border border-outline-border">
                        <ExternalLink className="w-3 h-3 text-pink-400" />
                        {result.evidenceSource ? "Link de Evidência" : "Item Vinculado"}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-2 border-t border-outline-border/60">
                    <SmallMetric label="Alcance" value={formatResultMetric(result.metrics?.reach)} />
                    <SmallMetric label="Cliques/Leads" value={formatResultMetric(result.metrics?.clicksOrLeads)} />
                    <SmallMetric label="CTR" value={formatResultMetric(result.metrics?.ctrPercent, "%")} />
                    <SmallMetric label="Conversão" value={formatResultMetric(result.metrics?.conversionRatePercent, "%")} />
                  </div>

                  {result.evidenceSource && (
                    <div className="mt-2 text-[10px] text-text-secondary flex items-center gap-1 truncate">
                      <Link2 className="w-3 h-3 shrink-0 text-text-secondary" />
                      <span className="truncate">{result.evidenceSource}</span>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* SUBTAB 3: EPISTEMIC LEARNINGS & RULES */}
      {activeSubTab === "learnings" && (
        <section className="bg-surface-card border border-outline-border rounded-xl p-5 min-h-[360px]">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <div>
                <h2 className="text-sm font-black text-text-primary">Base de Aprendizados & Regras Canônicas</h2>
                <p className="text-[10px] text-text-secondary">Regras validadas com evidência explícita que alimentam o motor de IA.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsAddLearningOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova Regra
            </button>
          </div>

          {snapshot.learnings.length === 0 ? (
            <EmptyState
              title="Nenhum aprendizado registrado"
              description="Registre hipóteses ou regras observadas a partir dos resultados para retroalimentar o sistema."
            />
          ) : (
            <div className="space-y-3">
              {snapshot.learnings.map((learning) => {
                const isConfirmed = learning.verdict === "CONFIRMADO";
                const isRefuted = learning.verdict === "A_EVITAR" || (learning as any).verdict === "REFUTADO";
                return (
                  <article key={learning.id} className="rounded-xl border border-outline-border bg-surface-container-low p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                            isConfirmed
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                              : isRefuted
                              ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                              : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                          }`}>
                            {learning.verdict.replace(/_/g, " ")}
                          </span>
                          <span className="text-[9px] uppercase text-text-secondary font-semibold">
                            {learning.category}
                          </span>
                        </div>
                        <h3 className="text-sm font-black text-text-primary mt-1.5">{learning.title}</h3>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {onUpdateLearning && (
                          <select
                            value={learning.verdict}
                            onChange={(e) => onUpdateLearning(learning.id, { verdict: e.target.value as any })}
                            className="bg-surface-card border border-outline-border rounded-lg px-2 py-1 text-[10px] font-bold text-text-primary focus:outline-none"
                            title="Alterar Veredicto Epistêmico"
                          >
                            <option value="CONFIRMADO">CONFIRMADO (Fato)</option>
                            <option value="EM_TESTE">EM TESTE (Hipótese)</option>
                            <option value="A_EVITAR">REFUTADO (A Evitar)</option>
                          </select>
                        )}

                        <button
                          type="button"
                          disabled={savingLearningId === learning.id}
                          onClick={() => handlePromoteLearningToVault(learning)}
                          className="px-2.5 py-1 rounded-lg border border-outline-border bg-surface-card hover:bg-surface-elevated text-text-primary text-[10px] font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                          title="Salvar como Nota Canônica na Base de Conhecimento do Obsidian"
                        >
                          {savingLearningId === learning.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3 text-pink-400" />
                          )}
                          Salvar Canônica
                        </button>

                        {onDeleteLearning && (
                          <button
                            type="button"
                            onClick={() => onDeleteLearning(learning.id)}
                            className="w-7 h-7 rounded-lg border border-outline-border flex items-center justify-center text-text-secondary hover:text-rose-400 transition-colors"
                            title="Remover aprendizado"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-text-primary leading-relaxed bg-surface-card p-3 rounded-lg border border-outline-border/60">
                      <strong className="text-pink-400 block text-[10px] uppercase font-bold mb-1">Regra Prática:</strong>
                      {learning.ruleOfThumb}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-text-secondary pt-1">
                      <div>
                        <strong className="text-text-primary block text-[10px] uppercase mb-0.5">Evidência:</strong>
                        <p>{learning.evidenceData}</p>
                      </div>
                      <div>
                        <strong className="text-text-primary block text-[10px] uppercase mb-0.5">Próxima Ação:</strong>
                        <p>{learning.suggestedAction}</p>
                      </div>
                    </div>

                    {learning.dateCreated && (
                      <div className="text-[9px] text-text-secondary/70 pt-1 border-t border-outline-border/40">
                        Registrado em {learning.dateCreated}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* SUBTAB 4: AI PERFORMANCE SYNTHESIS & CONTINUOUS FEEDBACK LOOP */}
      {activeSubTab === "synthesis" && (
        <section className="bg-surface-card border border-outline-border rounded-xl p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-outline-border">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-pink-400" />
              <div>
                <h2 className="text-sm font-black text-text-primary">Diagnóstico Epistêmico & Loop de Retroalimentação (IA)</h2>
                <p className="text-[10px] text-text-secondary">Síntese cruzada entre dados de engajamento, regras aprendidas e conhecimento do cofre.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={synthesisFocus}
                onChange={(e) => setSynthesisFocus(e.target.value)}
                placeholder="Foco específico (ex.: Instagram carrosséis)..."
                className="bg-black/20 border border-outline-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-secondary/70 focus:outline-none focus:border-pink-500/50 w-56"
              />
              <button
                type="button"
                disabled={isSynthesizing}
                onClick={handleRunAiSynthesis}
                className="px-3.5 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isSynthesizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {isSynthesizing ? "Analisando..." : "Executar Diagnóstico"}
              </button>
            </div>
          </div>

          {!synthesisResult ? (
            <div className="min-h-[260px] rounded-xl border border-dashed border-outline-border flex flex-col items-center justify-center p-8 text-center">
              <Sparkles className="w-8 h-8 text-pink-400/60 mb-2" />
              <h3 className="text-sm font-black text-text-primary">Nenhum diagnóstico gerado nesta sessão</h3>
              <p className="text-xs text-text-secondary max-w-md mt-1 mb-4 leading-relaxed">
                Clique em "Executar Diagnóstico" para que a IA analise todos os dados e produza recomendações para o próximo ciclo de planejamento.
              </p>
              <button
                type="button"
                disabled={isSynthesizing}
                onClick={handleRunAiSynthesis}
                className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold flex items-center gap-2"
              >
                {isSynthesizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                Gerar Diagnóstico Agora
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Resumo Executivo */}
              <div className="rounded-xl border border-pink-500/30 bg-pink-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-pink-400 tracking-wider">
                  <CheckCircle2 className="w-4 h-4" />
                  Resumo Executivo do Ciclo
                </div>
                <p className="text-xs text-text-primary leading-relaxed">{synthesisResult.executiveSummary}</p>
              </div>

              {/* Pontos Fortes e Riscos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase text-emerald-300 tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Pontos Fortes & Fórmulas Validadas
                  </h3>
                  <ul className="space-y-1.5 text-xs text-text-primary">
                    {synthesisResult.strengthsAndWins.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase text-rose-300 tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Riscos & Gargalos de Medição
                  </h3>
                  <ul className="space-y-1.5 text-xs text-text-primary">
                    {synthesisResult.weaknessesAndRisks.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-rose-400 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Regras Validadas Sugeridas */}
              {synthesisResult.validatedRules.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase text-text-primary tracking-wider">
                      Regras Identificadas pela IA para Incorporação Canônica
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {synthesisResult.validatedRules.map((rule, idx) => (
                      <div key={idx} className="rounded-xl border border-outline-border bg-surface-container-low p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-black text-text-primary">{rule.title}</h4>
                          <button
                            type="button"
                            onClick={() => handleAdoptValidatedRule(rule)}
                            className="px-2 py-1 rounded-md bg-pink-600 hover:bg-pink-500 text-white text-[10px] font-bold flex items-center gap-1 transition-colors shrink-0"
                          >
                            <Plus className="w-3 h-3" />
                            Adotar Regra
                          </button>
                        </div>
                        <p className="text-[11px] text-text-primary">{rule.ruleOfThumb}</p>
                        <div className="text-[10px] text-text-secondary">
                          <strong>Evidência:</strong> {rule.evidenceData}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hipóteses para o Próximo Ciclo */}
              {synthesisResult.hypothesesToTest.length > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase text-amber-300 tracking-wider flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5" /> Hipóteses a Validar no Próximo Ciclo
                  </h3>
                  <ul className="space-y-1.5 text-xs text-text-primary">
                    {synthesisResult.hypothesesToTest.map((hyp, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-400 font-bold">{idx + 1}.</span>
                        <span>{hyp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Modal: Add Result */}
      {isAddResultOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAddResult} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-outline-border bg-surface-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <span className="text-[10px] text-pink-400 uppercase tracking-widest font-black">Evidência de publicação</span>
                <h2 className="text-lg font-black text-text-primary mt-1">Registrar resultado</h2>
                <p className="text-[11px] text-text-secondary mt-1">Vazio significa não medido. O sistema não completa métricas ausentes.</p>
              </div>
              <button type="button" onClick={() => setIsAddResultOpen(false)} className="w-8 h-8 rounded-lg border border-outline-border flex items-center justify-center text-text-secondary" aria-label="Fechar resultado">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <Field label="Publicação do Calendário (opcional)">
                <select value={resultEditorialItemId} onChange={(event) => selectPublishedItem(event.target.value)} className={FIELD_INPUT_CLASS}>
                  <option value="">Registro manual sem vínculo editorial</option>
                  {publishedEditorialItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.title} — {item.platform}</option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Título *">
                  <input value={resultTitle} onChange={(event) => setResultTitle(event.target.value)} className={FIELD_INPUT_CLASS} placeholder="Publicação realmente realizada" />
                </Field>
                <Field label="Data/hora real da publicação *">
                  <input type="datetime-local" value={resultPublishedAt} onChange={(event) => setResultPublishedAt(event.target.value)} className={FIELD_INPUT_CLASS} />
                </Field>
                <Field label="Canal *">
                  <input value={resultChannel} onChange={(event) => setResultChannel(event.target.value)} className={FIELD_INPUT_CLASS} placeholder="Ex.: Instagram" />
                </Field>
                <Field label="Formato *">
                  <input value={resultFormat} onChange={(event) => setResultFormat(event.target.value)} className={FIELD_INPUT_CLASS} placeholder="Ex.: Reel" />
                </Field>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-secondary font-bold mb-2">Métricas medidas — todas opcionais</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <MetricInput label="Impressões" value={resultMetrics.impressions} onChange={(value) => setResultMetrics((current) => ({ ...current, impressions: value }))} />
                  <MetricInput label="Alcance" value={resultMetrics.reach} onChange={(value) => setResultMetrics((current) => ({ ...current, reach: value }))} />
                  <MetricInput label="Salvamentos" value={resultMetrics.saves} onChange={(value) => setResultMetrics((current) => ({ ...current, saves: value }))} />
                  <MetricInput label="Cliques / leads" value={resultMetrics.clicksOrLeads} onChange={(value) => setResultMetrics((current) => ({ ...current, clicksOrLeads: value }))} />
                  <MetricInput label="CTR (%)" value={resultMetrics.ctrPercent} onChange={(value) => setResultMetrics((current) => ({ ...current, ctrPercent: value }))} />
                  <MetricInput label="Conversão (%)" value={resultMetrics.conversionRatePercent} onChange={(value) => setResultMetrics((current) => ({ ...current, conversionRatePercent: value }))} />
                </div>
              </div>

              <Field label="Referência de evidência (opcional se houver métrica)">
                <div className="relative">
                  <Link2 className="absolute left-3 top-3 w-3.5 h-3.5 text-text-secondary" />
                  <input value={resultEvidenceSource} onChange={(event) => setResultEvidenceSource(event.target.value)} className={`${FIELD_INPUT_CLASS} pl-9`} placeholder="URL do post, relatório, nota ou outra referência verificável" />
                </div>
              </Field>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] text-amber-100 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                A data planejada no Calendário não é usada como data real. Confirme quando a publicação efetivamente ocorreu.
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => { resetResultForm(); setIsAddResultOpen(false); }} className="px-4 py-2 rounded-xl border border-outline-border text-xs font-bold text-text-primary">Cancelar</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-xs font-black text-white">Salvar resultado</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Add Learning */}
      {isAddLearningOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAddLearning} className="w-full max-w-xl rounded-2xl border border-outline-border bg-surface-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <span className="text-[10px] text-pink-400 uppercase tracking-widest font-black">Evidência obrigatória</span>
                <h2 className="text-lg font-black text-text-primary mt-1">Registrar regra ou hipótese</h2>
              </div>
              <button type="button" onClick={() => setIsAddLearningOpen(false)} className="w-8 h-8 rounded-lg border border-outline-border flex items-center justify-center text-text-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <Field label="Título">
                <input value={learningTitle} onChange={(event) => setLearningTitle(event.target.value)} className={FIELD_INPUT_CLASS} placeholder="Ex.: CTA específico gerou mais cliques" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Categoria">
                  <select value={learningCategory} onChange={(event) => setLearningCategory(event.target.value as LearningInsight["category"])} className={FIELD_INPUT_CLASS}>
                    <option value="formato">Formato</option>
                    <option value="horario">Horário</option>
                    <option value="nicho">Nicho</option>
                    <option value="emocao">Emoção</option>
                    <option value="copywriting">Copywriting</option>
                  </select>
                </Field>
                <Field label="Status da hipótese">
                  <select value={learningVerdict} onChange={(event) => setLearningVerdict(event.target.value as LearningInsight["verdict"])} className={FIELD_INPUT_CLASS}>
                    <option value="EM_TESTE">Em teste (Hipótese)</option>
                    <option value="CONFIRMADO">CONFIRMADO (Fato Canônico)</option>
                    <option value="A_EVITAR">A evitar (Refutado)</option>
                  </select>
                </Field>
              </div>

              <Field label="Regra observada">
                <textarea value={learningRule} onChange={(event) => setLearningRule(event.target.value)} rows={2} className={`${FIELD_INPUT_CLASS} resize-none`} placeholder="O que exatamente você acredita ter aprendido?" />
              </Field>
              <Field label="Evidência">
                <textarea value={learningEvidence} onChange={(event) => setLearningEvidence(event.target.value)} rows={3} className={`${FIELD_INPUT_CLASS} resize-none`} placeholder="Quais resultados, testes ou registros sustentam essa regra?" />
              </Field>
              <Field label="Próxima ação">
                <textarea value={learningAction} onChange={(event) => setLearningAction(event.target.value)} rows={2} className={`${FIELD_INPUT_CLASS} resize-none`} placeholder="Como essa hipótese será aplicada ou testada novamente?" />
              </Field>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setIsAddLearningOpen(false)} className="px-4 py-2 rounded-xl border border-outline-border text-xs font-bold text-text-primary">Cancelar</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-xs font-black text-white">Salvar aprendizado</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-outline-border bg-surface-card p-4 min-h-[88px]">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px] uppercase tracking-wider text-text-secondary font-bold">{label}</span>
        {sub && <span className="text-[8px] text-text-secondary/70 font-normal">{sub}</span>}
      </div>
      <strong className="block text-xl font-black text-text-primary mt-2">{value}</strong>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-card border border-outline-border/70 p-2">
      <span className="text-[8px] uppercase tracking-wider text-text-secondary font-bold">{label}</span>
      <strong className="block text-xs text-text-primary mt-0.5">{value}</strong>
    </div>
  );
}

function MetricInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[9px] uppercase tracking-wider text-text-secondary font-bold mb-1">{label}</span>
      <input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} className={FIELD_INPUT_CLASS} placeholder="Não medido" />
    </label>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-h-[180px] rounded-xl border border-dashed border-outline-border flex items-center justify-center p-6 text-center">
      <div className="max-w-sm">
        <h3 className="text-xs font-black text-text-primary">{title}</h3>
        <p className="text-[11px] text-text-secondary mt-1.5 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-text-secondary font-bold mb-1">{label}</span>
      {children}
    </label>
  );
}
