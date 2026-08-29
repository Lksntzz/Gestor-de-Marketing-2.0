import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  ExternalLink,
  Lightbulb,
  Link2,
  Plus,
  X,
} from "lucide-react";
import type { EditorialItem, LearningInsight, PostHistoryItem } from "../types";
import { localDateKey } from "../utils/reliability";
import {
  buildLearningSnapshot,
  formatRecordedMetric,
} from "../utils/learningIntelligence";

interface RoutineIntelligenceViewProps {
  postHistory: PostHistoryItem[];
  learnings: LearningInsight[];
  onAddPostHistory: (result: Omit<PostHistoryItem, "id">) => void;
  onAddLearning: (learning: Omit<LearningInsight, "id">) => void;
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

export const RoutineIntelligenceView: React.FC<RoutineIntelligenceViewProps> = ({
  postHistory = [],
  learnings = [],
  onAddPostHistory,
  onAddLearning,
  showToast,
}) => {
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

  const snapshot = useMemo(
    () => buildLearningSnapshot(postHistory, learnings),
    [postHistory, learnings],
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

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-5 font-sans overflow-y-auto no-scrollbar pb-6">
      <header className="shrink-0 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-outline-border">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-pink-500">
            <BookOpenCheck className="w-3.5 h-3.5" />
            Evidência antes de conclusão
          </div>
          <h1 className="text-2xl font-black text-text-primary mt-1">Aprender</h1>
          <p className="text-xs text-text-secondary mt-1 max-w-3xl leading-relaxed">
            Registre o que realmente aconteceu após a publicação. Campos não medidos permanecem ausentes; aprendizados exigem evidência explícita antes de virar regra.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setIsAddResultOpen(true)}
            className="px-4 py-2.5 rounded-xl border border-outline-border bg-surface-card text-text-primary text-xs font-black flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            Registrar resultado
          </button>
          <button
            type="button"
            onClick={() => setIsAddLearningOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Registrar aprendizado
          </button>
        </div>
      </header>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-pink-400" />
          <div>
            <h2 className="text-sm font-black text-text-primary">Resultados registrados</h2>
            <p className="text-[10px] text-text-secondary">Somente valores existentes no histórico; ausência nunca é convertida em zero.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <MetricCard label="Registros" value={String(snapshot.recordedResults)} />
          <MetricCard label="Alcance" value={formatRecordedMetric(snapshot.reach)} />
          <MetricCard label="Cliques / leads" value={formatRecordedMetric(snapshot.clicksOrLeads)} />
          <MetricCard label="CTR médio" value={formatRecordedMetric(snapshot.averageCtr, "%")} />
          <MetricCard label="Conversão média" value={formatRecordedMetric(snapshot.averageConversionRate, "%")} />
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 min-h-0">
        <section className="xl:col-span-7 bg-surface-card border border-outline-border rounded-xl p-5 min-h-[320px]">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-4 h-4 text-pink-400" />
            <div>
              <h2 className="text-sm font-black text-text-primary">Histórico recente</h2>
              <p className="text-[10px] text-text-secondary">Últimos resultados registrados no workspace.</p>
            </div>
          </div>

          {snapshot.latestResults.length === 0 ? (
            <EmptyState
              title="Nenhum resultado registrado"
              description="Registre uma publicação real e apenas as métricas que você efetivamente mediu."
            />
          ) : (
            <div className="space-y-2">
              {snapshot.latestResults.slice(0, 12).map((result) => (
                <article key={result.id} className="rounded-xl border border-outline-border bg-surface-container-low p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-xs font-black text-text-primary truncate">{result.title}</h3>
                      <p className="text-[10px] text-text-secondary mt-1">
                        {result.channel} · {result.format.replace(/_/g, " ")} · {formatPublishedAt(result.publishedAt)}
                      </p>
                    </div>
                    {(result.editorialItemId || result.linkedObsidianNote || result.evidenceSource) && (
                      <span className="shrink-0 text-[9px] uppercase tracking-wider text-text-secondary flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> evidência ligada
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                    <SmallMetric label="Alcance" value={formatResultMetric(result.metrics?.reach)} />
                    <SmallMetric label="Cliques/leads" value={formatResultMetric(result.metrics?.clicksOrLeads)} />
                    <SmallMetric label="CTR" value={formatResultMetric(result.metrics?.ctrPercent, "%")} />
                    <SmallMetric label="Conversão" value={formatResultMetric(result.metrics?.conversionRatePercent, "%")} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="xl:col-span-5 bg-surface-card border border-outline-border rounded-xl p-5 min-h-[320px]">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <div>
                <h2 className="text-sm font-black text-text-primary">Aprendizados com evidência</h2>
                <p className="text-[10px] text-text-secondary">Regra + evidência + próxima ação.</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-text-secondary">{snapshot.learnings.length}</span>
          </div>

          {snapshot.learnings.length === 0 ? (
            <EmptyState
              title="Nenhum aprendizado registrado"
              description="Não há conclusão automática. Registre uma regra somente quando houver evidência suficiente para justificar a próxima ação."
            />
          ) : (
            <div className="space-y-2">
              {snapshot.learnings.map((learning) => (
                <article key={learning.id} className="rounded-xl border border-outline-border bg-surface-container-low p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-black text-text-primary">{learning.title}</h3>
                    <span className="text-[9px] px-2 py-0.5 rounded-md border border-outline-border text-text-secondary uppercase">
                      {learning.verdict.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-primary mt-3 leading-relaxed">{learning.ruleOfThumb}</p>
                  <div className="mt-3 pt-3 border-t border-outline-border/70 space-y-2 text-[10px] text-text-secondary leading-relaxed">
                    <p><strong className="text-text-primary">Evidência:</strong> {learning.evidenceData}</p>
                    <p><strong className="text-text-primary">Próxima ação:</strong> {learning.suggestedAction}</p>
                    <p className="text-text-secondary/70">Registrado em {learning.dateCreated}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-[11px] text-emerald-100 flex items-start gap-2">
        <BookOpenCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-300" />
        <p>
          O histórico legado continua compatível, mas novos resultados usam um registro esparso: somente fatos e métricas realmente informados entram no workspace.
        </p>
      </div>

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

      {isAddLearningOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAddLearning} className="w-full max-w-xl rounded-2xl border border-outline-border bg-surface-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <span className="text-[10px] text-pink-400 uppercase tracking-widest font-black">Evidência obrigatória</span>
                <h2 className="text-lg font-black text-text-primary mt-1">Registrar aprendizado</h2>
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
                    <option value="EM_TESTE">Em teste</option>
                    <option value="ALTO_IMPACTO">Alto impacto</option>
                    <option value="VENCEDOR">Vencedor</option>
                    <option value="A_EVITAR">A evitar</option>
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline-border bg-surface-card p-4 min-h-[88px]">
      <span className="text-[9px] uppercase tracking-wider text-text-secondary font-bold">{label}</span>
      <strong className="block text-xl font-black text-text-primary mt-2">{value}</strong>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-card border border-outline-border/70 p-2.5">
      <span className="text-[8px] uppercase tracking-wider text-text-secondary">{label}</span>
      <strong className="block text-xs text-text-primary mt-1">{value}</strong>
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
    <div className="min-h-[220px] rounded-xl border border-dashed border-outline-border flex items-center justify-center p-6 text-center">
      <div className="max-w-sm">
        <h3 className="text-sm font-black text-text-primary">{title}</h3>
        <p className="text-[11px] text-text-secondary mt-2 leading-relaxed">{description}</p>
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
