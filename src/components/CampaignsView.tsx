import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Layers,
  Loader2,
  Save,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import type { EngineMode, MarketingCampaign, ObsidianApiConfig, ObsidianNote } from "../types";
import { api } from "../services/api";

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

export const CampaignsView: React.FC<CampaignsViewProps> = ({
  campaigns = [],
  notes = [],
  onGenerateCampaign,
  isGenerating,
  onSaveCampaignToObsidian,
  onImportCampaignTasks,
  apiConfig,
  engineMode = "local",
  onToggleEngineMode,
}) => {
  const [mode, setMode] = useState<"wizard" | "saved">("wizard");
  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState("");
  const [objective, setObjective] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [channels, setChannels] = useState<string[]>(["Instagram"]);
  const [selectedNotePaths, setSelectedNotePaths] = useState<string[]>([]);
  const [customInstructions, setCustomInstructions] = useState("");
  const [noteSearch, setNoteSearch] = useState("");
  const [isGeneratingGuidelines, setIsGeneratingGuidelines] = useState(false);

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
    setChannels((current) => {
      if (current.includes(channel)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== channel);
      }
      return [...current, channel];
    });
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
      }
    } finally {
      setIsGeneratingGuidelines(false);
    }
  };

  const generateCampaign = async () => {
    if (!campaignName.trim() || !objective.trim() || channels.length === 0) return;
    await onGenerateCampaign({
      campaignName: campaignName.trim(),
      objective: objective.trim(),
      channels,
      audience: audience.trim(),
      tone: tone.trim(),
      selectedNotePaths,
      customInstructions: customInstructions.trim() || undefined,
    });
    setStep(5);
  };

  const latestCampaign = campaigns[0] ?? null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 font-sans">
      <header className="flex shrink-0 flex-col gap-3 border-b border-outline-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-fixed-dim">Nisti Marketing</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-text-primary">Planejamento de Campanhas</h1>
          <p className="mt-1 text-xs text-text-secondary">Construa a campanha usando somente contexto selecionado da base conectada.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-outline-border bg-surface-container-low p-1">
            <button
              onClick={() => setMode("wizard")}
              className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === "wizard" ? "bg-primary-container text-white" : "text-text-secondary"}`}
            >
              Criar
            </button>
            <button
              onClick={() => setMode("saved")}
              className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === "saved" ? "bg-primary-container text-white" : "text-text-secondary"}`}
            >
              Salvas ({campaigns.length})
            </button>
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

      {mode === "saved" ? (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-outline-border bg-surface-card p-4">
          {campaigns.length === 0 ? (
            <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
              <Layers className="mb-3 h-8 w-8 text-text-secondary" />
              <h2 className="text-sm font-bold text-text-primary">Nenhuma campanha registrada</h2>
              <p className="mt-1 max-w-md text-xs text-text-secondary">As campanhas aprovadas aparecerão aqui após a geração.</p>
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {campaigns.map((campaign) => (
                <article key={campaign.id} className="rounded-xl border border-outline-border bg-surface-container-low p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">{campaign.status}</p>
                      <h2 className="mt-1 text-base font-bold text-text-primary">{campaign.title}</h2>
                      <p className="mt-2 text-xs leading-5 text-text-secondary">{campaign.summary}</p>
                    </div>
                    <Target className="h-5 w-5 shrink-0 text-primary-fixed-dim" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => onSaveCampaignToObsidian(campaign)}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-3 py-2 text-xs font-bold text-white"
                    >
                      <Save className="h-3.5 w-3.5" /> Salvar no Obsidian
                    </button>
                    <button
                      onClick={() => onImportCampaignTasks(campaign)}
                      className="rounded-lg border border-outline-border px-3 py-2 text-xs font-bold text-text-primary"
                    >
                      Importar tarefas
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="grid shrink-0 grid-cols-5 gap-2">
            {["Definição", "Base", "Canais", "Revisão", "Resultado"].map((label, index) => {
              const number = index + 1;
              const active = number === step;
              const done = number < step;
              return (
                <button
                  key={label}
                  disabled={number > step}
                  onClick={() => number <= step && setStep(number)}
                  className={`rounded-xl border px-2 py-2 text-[10px] font-bold uppercase tracking-wider ${active ? "border-primary-container bg-primary-container/15 text-primary-fixed-dim" : done ? "border-success-sober/40 bg-success-sober/10 text-success-sober" : "border-outline-border bg-surface-container-low text-text-secondary"}`}
                >
                  {done ? <Check className="mx-auto mb-1 h-3.5 w-3.5" /> : <span className="mb-1 block">{number}</span>}
                  {label}
                </button>
              );
            })}
          </div>

          <section className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-outline-border bg-surface-card p-5">
            {step === 1 && (
              <div className="mx-auto max-w-3xl space-y-5">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Nome da campanha</label>
                  <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Ex.: Lançamento da coleção de setembro" className="mt-2 w-full rounded-xl border border-outline-border bg-surface-container-lowest px-4 py-3 text-sm text-text-primary outline-none focus:border-primary-container" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Objetivo</label>
                  <textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Descreva o resultado de marketing esperado." rows={5} className="mt-2 w-full resize-none rounded-xl border border-outline-border bg-surface-container-lowest px-4 py-3 text-sm text-text-primary outline-none focus:border-primary-container" />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                  <input value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)} placeholder="Buscar no cofre conectado" className="w-full rounded-xl border border-outline-border bg-surface-container-lowest py-3 pl-10 pr-4 text-sm text-text-primary outline-none focus:border-primary-container" />
                </div>
                {notes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-outline-border p-8 text-center">
                    <FileText className="mx-auto h-7 w-7 text-text-secondary" />
                    <p className="mt-2 text-sm font-bold text-text-primary">Nenhuma nota sincronizada</p>
                    <p className="mt-1 text-xs text-text-secondary">Sincronize o Obsidian antes de gerar uma campanha baseada em conhecimento.</p>
                  </div>
                ) : (
                  <div className="grid gap-2 lg:grid-cols-2">
                    {filteredNotes.map((note) => {
                      const selected = selectedNotePaths.includes(note.path);
                      return (
                        <button key={note.id} onClick={() => toggleNote(note.path)} className={`rounded-xl border p-3 text-left ${selected ? "border-primary-container bg-primary-container/10" : "border-outline-border bg-surface-container-low"}`}>
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? "border-primary-container bg-primary-container text-white" : "border-outline-border"}`}>{selected && <Check className="h-3.5 w-3.5" />}</div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-text-primary">{note.title}</p>
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
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Público</label>
                    <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Quem queremos alcançar?" className="mt-2 w-full rounded-xl border border-outline-border bg-surface-container-lowest px-4 py-3 text-sm text-text-primary outline-none focus:border-primary-container" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Tom</label>
                    <input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Ex.: direto, técnico, acolhedor" className="mt-2 w-full rounded-xl border border-outline-border bg-surface-container-lowest px-4 py-3 text-sm text-text-primary outline-none focus:border-primary-container" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Canais</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CHANNELS.map((channel) => (
                      <button key={channel} onClick={() => toggleChannel(channel)} className={`rounded-lg border px-3 py-2 text-xs font-bold ${channels.includes(channel) ? "border-primary-container bg-primary-container/15 text-primary-fixed-dim" : "border-outline-border text-text-secondary"}`}>{channel}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Diretrizes adicionais</label>
                    <button onClick={generateGuidelines} disabled={isGeneratingGuidelines || !campaignName.trim() || !objective.trim()} className="inline-flex items-center gap-2 rounded-lg border border-outline-border px-3 py-2 text-xs font-bold text-text-primary disabled:opacity-50">
                      {isGeneratingGuidelines ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Sugerir com IA
                    </button>
                  </div>
                  <textarea value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder="Opcional. Nenhuma alegação comercial será presumida sem base no cofre." rows={6} className="mt-2 w-full resize-none rounded-xl border border-outline-border bg-surface-container-lowest px-4 py-3 text-sm text-text-primary outline-none focus:border-primary-container" />
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
                  <ReviewItem label="Fontes PKM" value={`${selectedNotes.length} nota(s) selecionada(s)`} />
                </div>
                <div className="rounded-xl border border-outline-border bg-surface-container-low p-4 text-xs leading-5 text-text-secondary">
                  A geração deve se limitar ao objetivo informado e às fontes selecionadas. Dados comerciais não presentes no cofre devem permanecer como pendência, não como fato.
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="mx-auto max-w-3xl">
                {latestCampaign ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-success-sober">Campanha gerada</p>
                      <h2 className="mt-1 text-xl font-black text-text-primary">{latestCampaign.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-text-secondary">{latestCampaign.summary}</p>
                    </div>
                    <div className="rounded-xl border border-outline-border bg-surface-container-low p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Estratégia</p>
                      <p className="mt-2 text-sm leading-6 text-text-primary">{latestCampaign.strategy}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => onSaveCampaignToObsidian(latestCampaign)} className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2.5 text-xs font-bold text-white"><Save className="h-3.5 w-3.5" /> Salvar no Obsidian</button>
                      <button onClick={() => onImportCampaignTasks(latestCampaign)} className="rounded-lg border border-outline-border px-4 py-2.5 text-xs font-bold text-text-primary">Importar tarefas</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">Aguardando resultado da geração.</p>
                )}
              </div>
            )}
          </section>

          <footer className="flex shrink-0 items-center justify-between gap-3">
            <button onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1 || isGenerating} className="inline-flex items-center gap-2 rounded-xl border border-outline-border px-4 py-2.5 text-xs font-bold text-text-primary disabled:opacity-40"><ArrowLeft className="h-4 w-4" /> Voltar</button>
            {step < 4 && (
              <button onClick={() => canContinue && setStep((current) => Math.min(4, current + 1))} disabled={!canContinue} className="inline-flex items-center gap-2 rounded-xl bg-primary-container px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">Continuar <ArrowRight className="h-4 w-4" /></button>
            )}
            {step === 4 && (
              <button onClick={generateCampaign} disabled={isGenerating || !canContinue} className="inline-flex items-center gap-2 rounded-xl bg-primary-container px-5 py-2.5 text-xs font-bold text-white disabled:opacity-40">
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar campanha
              </button>
            )}
            {step === 5 && (
              <button onClick={() => { setStep(1); setCampaignName(""); setObjective(""); setAudience(""); setTone(""); setSelectedNotePaths([]); setCustomInstructions(""); }} className="rounded-xl border border-outline-border px-4 py-2.5 text-xs font-bold text-text-primary">Nova campanha</button>
            )}
          </footer>
        </div>
      )}

      {apiConfig.connectionStatus !== "connected" && (
        <div className="shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          O Obsidian está desconectado. A campanha pode ser preparada, mas salvar no cofre exige conexão validada.
        </div>
      )}
    </div>
  );
};

const ReviewItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-outline-border bg-surface-container-low p-4">
    <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{label}</p>
    <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-5 text-text-primary">{value || "Pendente"}</p>
  </div>
);
