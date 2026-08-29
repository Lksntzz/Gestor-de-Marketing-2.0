import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Layers,
  Loader2,
  Plus,
  Save,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import type {
  EngineMode,
  MarketingCampaign,
  MarketingTask,
  ObsidianApiConfig,
  ObsidianNote,
} from "../types";
import { api } from "../services/api";
import { APP_STATE_KEYS } from "../services/storage/StorageManager";
import { AppStateSchemas } from "../domain/appStateSchemas";
import { usePersistentState } from "../hooks/usePersistentState";
import { generateLocalCampaign } from "../utils/localEngine";
import { localDateKey } from "../utils/reliability";
import {
  deriveCampaignEpistemicStatus,
  type GroundedCampaign,
  normalizeSuggestedTasks,
} from "../utils/resultsIntelligence";

interface CampaignsViewProps {
  campaigns: MarketingCampaign[];
  notes: ObsidianNote[];
  apiConfig: ObsidianApiConfig;
  engineMode?: EngineMode;
  [legacyProp: string]: unknown;
}

const CHANNELS = ["Instagram", "WhatsApp", "Email", "TikTok / Reels", "LinkedIn", "Blog"];
const FIELD_CLASS = "w-full rounded-xl border border-outline-border bg-surface-container-low px-3 py-2.5 text-xs text-text-primary placeholder:text-text-secondary/70 focus:outline-none focus:border-pink-500/50";

function statusLabel(status: MarketingCampaign["status"]): string {
  if (status === "draft") return "Rascunho";
  if (status === "scheduled") return "Agendada";
  if (status === "active") return "Ativa";
  return "Concluída";
}

function titleFromPath(path: string): string {
  return path.split("/").pop()?.replace(/\.md$/i, "") || path;
}

function safeCampaignFileTitle(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
}

export const CampaignsView: React.FC<CampaignsViewProps> = ({
  campaigns = [],
  notes = [],
  apiConfig,
  engineMode = "local",
}) => {
  const [campaignStore, setCampaignStore] = usePersistentState<MarketingCampaign[]>(
    APP_STATE_KEYS.CAMPAIGNS,
    campaigns,
    AppStateSchemas.campaigns,
  );
  const [taskStore, setTaskStore] = usePersistentState<MarketingTask[]>(
    APP_STATE_KEYS.TASKS,
    [],
    AppStateSchemas.tasks,
  );

  const liveCampaigns = campaignStore as GroundedCampaign[];
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(campaigns[0]?.id || null);
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [savingCampaignId, setSavingCampaignId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "warning" | "info"; text: string } | null>(null);

  const [campaignName, setCampaignName] = useState("");
  const [objective, setObjective] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [selectedNotePaths, setSelectedNotePaths] = useState<string[]>([]);
  const [customInstructions, setCustomInstructions] = useState("");
  const [noteSearch, setNoteSearch] = useState("");

  const selectedCampaign = useMemo(
    () => liveCampaigns.find((campaign) => campaign.id === selectedCampaignId) || liveCampaigns[0] || null,
    [liveCampaigns, selectedCampaignId],
  );

  const filteredNotes = useMemo(() => {
    const query = noteSearch.trim().toLocaleLowerCase("pt-BR");
    if (!query) return notes;
    return notes.filter((note) =>
      `${note.title} ${note.folder} ${(note.tags || []).join(" ")}`
        .toLocaleLowerCase("pt-BR")
        .includes(query),
    );
  }, [noteSearch, notes]);

  const resetBriefing = () => {
    setCampaignName("");
    setObjective("");
    setAudience("");
    setTone("");
    setChannels([]);
    setSelectedNotePaths([]);
    setCustomInstructions("");
    setNoteSearch("");
  };

  const closeBriefing = () => {
    setIsBriefingOpen(false);
    resetBriefing();
  };

  const toggleChannel = (channel: string) => {
    setChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel],
    );
  };

  const toggleNote = (path: string) => {
    setSelectedNotePaths((current) =>
      current.includes(path)
        ? current.filter((item) => item !== path)
        : [...current, path],
    );
  };

  const validateBriefing = (): string | null => {
    if (!campaignName.trim()) return "Informe o nome da campanha.";
    if (!objective.trim()) return "Informe o objetivo da campanha.";
    if (!audience.trim()) return "Informe o público que esta campanha deve atender.";
    if (!tone.trim()) return "Informe o tom de comunicação.";
    if (channels.length === 0) return "Escolha ao menos um canal.";
    if (selectedNotePaths.length === 0) return "Selecione ao menos uma fonte da Base para fundamentar o rascunho.";
    return null;
  };

  const generateCampaignDraft = async () => {
    if (isGenerating) return;
    const validation = validateBriefing();
    if (validation) {
      setNotice({ type: "warning", text: validation });
      return;
    }

    setIsGenerating(true);
    setNotice(null);

    try {
      const matchedNotes = notes.filter((note) => selectedNotePaths.includes(note.path));
      let data: any;
      let usedEngine = engineMode === "local" ? "Motor Local Grounded" : "IA configurada";
      let wasFallback = false;
      let contextWarning = "";

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
        usedEngine = data?.usedEngine || usedEngine;
      } else {
        try {
          const response = await api.generateCampaign({
            campaignName: campaignName.trim(),
            objective: objective.trim(),
            channels,
            audience: audience.trim(),
            tone: tone.trim(),
            knowledgeNotes: notes,
            preferredSourcePaths: selectedNotePaths,
            customInstructions: customInstructions.trim() || undefined,
            engineMode,
          });
          if (!response?.success || !response?.data) {
            throw new Error("A IA não retornou um rascunho válido.");
          }
          data = response.data;
          usedEngine = response.usedModel || usedEngine;
          wasFallback = Boolean(response.wasFallback);
          contextWarning = String(response.contextWarning || "");
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
          usedEngine = data?.usedEngine || "Motor Local Grounded (fallback)";
          wasFallback = true;
          contextWarning = "A IA configurada não respondeu. O rascunho foi produzido pelo motor local grounded e precisa de revisão humana.";
        }
      }

      const campaignId = `camp-${Date.now()}`;
      const fileTitle = safeCampaignFileTitle(campaignName.trim());
      const outputNotePath = `04_Campanhas/${fileTitle}.md`;
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
      setSelectedCampaignId(draft.id);
      closeBriefing();
      setNotice({
        type: contextWarning ? "warning" : "success",
        text: contextWarning || `Rascunho criado como ${epistemicStatus}. Nada foi salvo no Vault, agendado ou enviado para Execução automaticamente.`,
      });
    } catch (error: any) {
      setNotice({ type: "warning", text: error?.message || "Falha ao gerar o rascunho da campanha." });
    } finally {
      setIsGenerating(false);
    }
  };

  const saveCampaignToObsidian = async (campaign: GroundedCampaign) => {
    if (apiConfig.connectionStatus !== "connected") {
      setNotice({ type: "warning", text: "Conecte e valide a Base antes de gravar a campanha no Vault." });
      return;
    }
    if (!campaign.generatedMarkdown?.trim() || !campaign.obsidianOutputNotePath) {
      setNotice({ type: "warning", text: "Este rascunho não possui Markdown rastreável para gravar no Vault." });
      return;
    }

    setSavingCampaignId(campaign.id);
    try {
      const result = await api.pushNoteToObsidian(
        apiConfig,
        campaign.obsidianOutputNotePath,
        campaign.generatedMarkdown,
      );
      if (!result?.success) throw new Error(result?.message || "O Obsidian não confirmou a gravação.");

      const savedAt = new Date().toISOString();
      setCampaignStore((current) =>
        current.map((item) =>
          item.id === campaign.id
            ? ({ ...item, savedToObsidianAt: savedAt } as GroundedCampaign)
            : item,
        ),
      );
      setNotice({
        type: "success",
        text: `Rascunho confirmado no Vault em ${campaign.obsidianOutputNotePath}. O status da campanha permanece sob controle manual.`,
      });
    } catch (error: any) {
      setNotice({ type: "warning", text: error?.message || "Falha ao gravar a campanha no Vault." });
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
      const existingKeys = new Set(
        current.map((task) => `${task.linkedCampaignId || ""}::${task.title.toLocaleLowerCase("pt-BR")}`),
      );
      const fresh = suggested.filter((task) => {
        const key = `${campaign.id}::${task.title.toLocaleLowerCase("pt-BR")}`;
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
    setCampaignStore((current) =>
      current.map((campaign) => campaign.id === campaignId ? { ...campaign, status } : campaign),
    );
    setNotice({ type: "info", text: `Status alterado manualmente para ${statusLabel(status)}.` });
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 font-sans">
      <header className="flex shrink-0 flex-col gap-3 border-b border-outline-border pb-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-pink-400">Planejamento estratégico</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-text-primary">Campanhas</h1>
          <p className="mt-1 max-w-3xl text-xs text-text-secondary">
            Agrupe objetivo, público, canais e fontes em um rascunho estratégico. Gerar não significa aprovar, agendar, salvar no Vault ou criar tarefas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setIsBriefingOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-pink-600 px-4 py-2.5 text-xs font-black text-white hover:bg-pink-500 self-start xl:self-auto"
        >
          <Plus className="h-4 w-4" /> Nova campanha
        </button>
      </header>

      {notice && (
        <div className={`shrink-0 rounded-xl border px-4 py-3 text-xs ${
          notice.type === "success"
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : notice.type === "warning"
              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
              : "border-outline-border bg-surface-container-low text-text-secondary"
        }`}>
          {notice.text}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-12">
        <section className="xl:col-span-4 min-h-0 rounded-2xl border border-outline-border bg-surface-card p-4 flex flex-col">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-text-primary">Campanhas registradas</h2>
              <p className="text-[10px] text-text-secondary">{liveCampaigns.length} no workspace</p>
            </div>
            <Layers className="h-4 w-4 text-pink-400" />
          </div>

          <div className="space-y-2 overflow-y-auto no-scrollbar pr-1">
            {liveCampaigns.length === 0 ? (
              <div className="min-h-48 rounded-xl border border-dashed border-outline-border flex items-center justify-center p-5 text-center">
                <div>
                  <Target className="w-6 h-6 text-text-secondary mx-auto mb-2" />
                  <p className="text-xs font-bold text-text-primary">Nenhuma campanha registrada</p>
                  <p className="text-[10px] text-text-secondary mt-1">Crie um briefing fundamentado para gerar o primeiro rascunho.</p>
                </div>
              </div>
            ) : liveCampaigns.map((campaign) => {
              const grounded = campaign as GroundedCampaign;
              const active = selectedCampaign?.id === campaign.id;
              return (
                <button
                  key={campaign.id}
                  type="button"
                  onClick={() => setSelectedCampaignId(campaign.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? "border-pink-500/40 bg-pink-500/10"
                      : "border-outline-border bg-surface-container-low hover:bg-surface-elevated"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <strong className="text-xs text-text-primary line-clamp-2">{campaign.title}</strong>
                    <span className="shrink-0 text-[9px] uppercase text-text-secondary">{statusLabel(campaign.status)}</span>
                  </div>
                  <p className="text-[10px] text-text-secondary mt-2 line-clamp-2">{campaign.objective}</p>
                  <div className="flex gap-1 flex-wrap mt-2">
                    {grounded.epistemicStatus && (
                      <span className="text-[9px] rounded-md border border-outline-border px-1.5 py-0.5 text-text-secondary">{grounded.epistemicStatus}</span>
                    )}
                    {campaign.channels.slice(0, 2).map((channel) => (
                      <span key={channel} className="text-[9px] rounded-md border border-outline-border px-1.5 py-0.5 text-text-secondary">{channel}</span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="xl:col-span-8 min-h-0 rounded-2xl border border-outline-border bg-surface-card p-5 overflow-y-auto no-scrollbar">
          {!selectedCampaign ? (
            <div className="min-h-[420px] flex items-center justify-center text-center p-6">
              <div className="max-w-sm">
                <Sparkles className="w-7 h-7 text-pink-400 mx-auto mb-3" />
                <h2 className="text-base font-black text-text-primary">Selecione ou crie uma campanha</h2>
                <p className="text-xs text-text-secondary mt-2">Campanhas servem como agrupadores estratégicos. Resultados pertencem à etapa Aprender.</p>
              </div>
            </div>
          ) : (
            <CampaignDetail
              campaign={selectedCampaign}
              notes={notes}
              isSaving={savingCampaignId === selectedCampaign.id}
              isBaseConnected={apiConfig.connectionStatus === "connected"}
              onSaveToVault={() => void saveCampaignToObsidian(selectedCampaign)}
              onImportTasks={() => importCampaignTasks(selectedCampaign)}
              onChangeStatus={(status) => updateCampaignStatus(selectedCampaign.id, status)}
            />
          )}
        </section>
      </div>

      {isBriefingOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-outline-border bg-surface-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <span className="text-[10px] uppercase tracking-widest font-black text-pink-400">Briefing único</span>
                <h2 className="text-xl font-black text-text-primary mt-1">Nova campanha</h2>
                <p className="text-xs text-text-secondary mt-1">Todos os campos decisórios são explícitos. A Base fundamenta o rascunho, mas não escolhe público, tom ou canal por você.</p>
              </div>
              <button type="button" onClick={closeBriefing} className="w-8 h-8 rounded-lg border border-outline-border flex items-center justify-center text-text-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <Field label="Nome da campanha">
                  <input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} className={FIELD_CLASS} placeholder="Nome identificável" />
                </Field>
                <Field label="Objetivo">
                  <textarea value={objective} onChange={(event) => setObjective(event.target.value)} rows={2} className={`${FIELD_CLASS} resize-none`} placeholder="Qual resultado esta campanha pretende buscar?" />
                </Field>
                <Field label="Público">
                  <input value={audience} onChange={(event) => setAudience(event.target.value)} className={FIELD_CLASS} placeholder="Público explicitamente definido" />
                </Field>
                <Field label="Tom">
                  <input value={tone} onChange={(event) => setTone(event.target.value)} className={FIELD_CLASS} placeholder="Tom de comunicação" />
                </Field>

                <Field label="Canais">
                  <div className="flex flex-wrap gap-2">
                    {CHANNELS.map((channel) => (
                      <button
                        type="button"
                        key={channel}
                        onClick={() => toggleChannel(channel)}
                        className={`rounded-lg border px-3 py-2 text-[10px] font-bold ${
                          channels.includes(channel)
                            ? "border-pink-500/40 bg-pink-500/10 text-pink-300"
                            : "border-outline-border bg-surface-container-low text-text-secondary"
                        }`}
                      >
                        {channel}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Instruções adicionais — opcional">
                  <textarea value={customInstructions} onChange={(event) => setCustomInstructions(event.target.value)} rows={3} className={`${FIELD_CLASS} resize-none`} placeholder="Restrições ou contexto que realmente precisam ser considerados" />
                </Field>
              </div>

              <div className="rounded-xl border border-outline-border bg-surface-container-low p-4 flex flex-col min-h-[420px]">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-xs font-black text-text-primary">Fontes da Base</h3>
                    <p className="text-[10px] text-text-secondary">Selecione ao menos uma fonte.</p>
                  </div>
                  <span className="text-[10px] font-bold text-pink-300">{selectedNotePaths.length} selecionada(s)</span>
                </div>
                <div className="relative mb-3">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input value={noteSearch} onChange={(event) => setNoteSearch(event.target.value)} className={`${FIELD_CLASS} pl-9`} placeholder="Buscar fonte" />
                </div>
                <div className="space-y-2 overflow-y-auto no-scrollbar flex-1">
                  {filteredNotes.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-center text-[11px] text-text-secondary">Nenhuma fonte encontrada.</div>
                  ) : filteredNotes.map((note) => {
                    const selected = selectedNotePaths.includes(note.path);
                    return (
                      <button
                        type="button"
                        key={note.path}
                        onClick={() => toggleNote(note.path)}
                        className={`w-full rounded-xl border p-3 text-left ${
                          selected
                            ? "border-pink-500/40 bg-pink-500/10"
                            : "border-outline-border bg-surface-card hover:bg-surface-elevated"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <FileText className={`w-4 h-4 mt-0.5 shrink-0 ${selected ? "text-pink-400" : "text-text-secondary"}`} />
                          <div className="min-w-0 flex-1">
                            <strong className="text-[11px] text-text-primary block truncate">{note.title}</strong>
                            <span className="text-[9px] text-text-secondary block truncate mt-0.5">{note.folder}</span>
                          </div>
                          {selected && <CheckCircle2 className="w-4 h-4 text-pink-400 shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {notice?.type === "warning" && (
              <div className="mt-4 p-3 rounded-xl border border-amber-500/25 bg-amber-500/10 text-xs text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {notice.text}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={closeBriefing} className="px-4 py-2.5 rounded-xl border border-outline-border text-xs font-bold text-text-primary">Cancelar</button>
              <button
                type="button"
                onClick={() => void generateCampaignDraft()}
                disabled={isGenerating}
                className="px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-xs font-black text-white flex items-center gap-2"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Gerar rascunho
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function CampaignDetail({
  campaign,
  notes,
  isSaving,
  isBaseConnected,
  onSaveToVault,
  onImportTasks,
  onChangeStatus,
}: {
  campaign: GroundedCampaign;
  notes: ObsidianNote[];
  isSaving: boolean;
  isBaseConnected: boolean;
  onSaveToVault: () => void;
  onImportTasks: () => void;
  onChangeStatus: (status: MarketingCampaign["status"]) => void;
}) {
  const linkedNotes = notes.filter((note) => campaign.linkedNotePaths.includes(note.path));
  const suggestedTaskCount = campaign.suggestedTasks?.length || 0;

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-4 border-b border-outline-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] px-2 py-1 rounded-lg border border-outline-border text-text-secondary uppercase">{campaign.epistemicStatus || "PENDENTE"}</span>
            {campaign.wasFallback && <span className="text-[9px] px-2 py-1 rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-300">fallback local</span>}
            {campaign.savedToObsidianAt && <span className="text-[9px] px-2 py-1 rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">salva no Vault</span>}
          </div>
          <h2 className="text-xl font-black text-text-primary mt-3">{campaign.title}</h2>
          <p className="text-xs text-text-secondary mt-1">{campaign.objective}</p>
        </div>
        <label className="shrink-0">
          <span className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary mb-1">Status manual</span>
          <select value={campaign.status} onChange={(event) => onChangeStatus(event.target.value as MarketingCampaign["status"])} className={FIELD_CLASS}>
            <option value="draft">Rascunho</option>
            <option value="scheduled">Agendada</option>
            <option value="active">Ativa</option>
            <option value="completed">Concluída</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-5">
        <InfoBlock label="Público" value={campaign.targetAudience || "Não registrado"} />
        <InfoBlock label="Tom" value={campaign.tone || "Não registrado"} />
        <InfoBlock label="Resumo" value={campaign.summary || "Sem resumo gerado"} />
        <InfoBlock label="Estratégia" value={campaign.strategy || "Sem estratégia gerada"} />
      </div>

      <div className="mt-5">
        <span className="text-[10px] uppercase tracking-wider font-black text-text-secondary">Canais</span>
        <div className="flex flex-wrap gap-2 mt-2">
          {campaign.channels.length === 0
            ? <span className="text-xs text-text-secondary">Nenhum canal registrado.</span>
            : campaign.channels.map((channel) => <span key={channel} className="text-[10px] rounded-lg border border-outline-border bg-surface-container-low px-2.5 py-1 text-text-secondary">{channel}</span>)}
        </div>
      </div>

      <div className="mt-5">
        <span className="text-[10px] uppercase tracking-wider font-black text-text-secondary">Fontes usadas</span>
        <div className="space-y-2 mt-2">
          {linkedNotes.length === 0 ? (
            <div className="text-xs text-text-secondary">As referências originais não estão disponíveis no snapshot atual.</div>
          ) : linkedNotes.map((note) => (
            <div key={note.path} className="rounded-xl border border-outline-border bg-surface-container-low p-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-text-secondary shrink-0" />
              <div className="min-w-0">
                <strong className="text-[11px] text-text-primary block truncate">{titleFromPath(note.path)}</strong>
                <span className="text-[9px] text-text-secondary block truncate">{note.path}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 pt-5 border-t border-outline-border flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onSaveToVault}
          disabled={isSaving || !isBaseConnected || !campaign.generatedMarkdown?.trim()}
          className="px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-xs font-black text-white flex items-center gap-2"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar no Vault
        </button>
        <button
          type="button"
          onClick={onImportTasks}
          disabled={suggestedTaskCount === 0}
          className="px-4 py-2.5 rounded-xl border border-outline-border bg-surface-container-low disabled:opacity-40 text-xs font-bold text-text-primary flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          Importar {suggestedTaskCount || ""} tarefa{suggestedTaskCount === 1 ? "" : "s"}
        </button>
      </div>

      <p className="text-[10px] text-text-secondary mt-3">
        Motor usado: {campaign.usedEngine || "não registrado"}. Salvar e importar tarefas são confirmações independentes.
      </p>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline-border bg-surface-container-low p-4">
      <span className="text-[9px] uppercase tracking-wider font-bold text-text-secondary">{label}</span>
      <p className="text-xs text-text-primary mt-2 leading-relaxed whitespace-pre-line">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider font-bold text-text-secondary mb-1">{label}</span>
      {children}
    </label>
  );
}
