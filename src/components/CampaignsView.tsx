import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  FileText,
  FolderOpen,
  Layers,
  Loader2,
  Sparkles,
  Target,
} from "lucide-react";
import { EngineMode, MarketingCampaign, ObsidianApiConfig, ObsidianNote } from "../types";

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

const STEPS = [
  { num: 1, label: "DEFINIÇÃO" },
  { num: 2, label: "NOTAS PKM" },
  { num: 3, label: "CANAIS" },
  { num: 4, label: "PRÉVIA" },
  { num: 5, label: "RESULTADO" },
];

const CHANNELS = ["Instagram", "WhatsApp", "Email", "LinkedIn", "TikTok / Reels", "Blog"];
const OBJECTIVES = ["Lead Gen", "Vendas", "Branding", "Retenção"];

export const CampaignsView: React.FC<CampaignsViewProps> = ({
  campaigns,
  notes,
  onGenerateCampaign,
  isGenerating,
  onSaveCampaignToObsidian,
  onImportCampaignTasks,
  apiConfig,
  engineMode = "local",
  onToggleEngineMode,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [campaignName, setCampaignName] = useState("");
  const [objective, setObjective] = useState("Lead Gen");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["Instagram"]);
  const [selectedNotePaths, setSelectedNotePaths] = useState<string[]>([]);
  const [noteSearch, setNoteSearch] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) || campaigns[0] || null;
  const filteredNotes = useMemo(() => {
    const query = noteSearch.trim().toLowerCase();
    return notes.filter((note) => !query || note.title.toLowerCase().includes(query) || note.folder.toLowerCase().includes(query));
  }, [notes, noteSearch]);

  const toggleChannel = (channel: string) => {
    setSelectedChannels((current) => current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]);
  };

  const toggleNote = (path: string) => {
    setSelectedNotePaths((current) => current.includes(path) ? current.filter((item) => item !== path) : [...current, path]);
  };

  const canContinue = () => {
    if (currentStep === 1) return Boolean(campaignName.trim() && objective.trim());
    if (currentStep === 3) return selectedChannels.length > 0;
    return true;
  };

  const runGeneration = async () => {
    if (!campaignName.trim()) return;
    await onGenerateCampaign({
      campaignName: campaignName.trim(),
      objective: objective.trim(),
      channels: selectedChannels,
      audience: audience.trim(),
      tone: tone.trim(),
      selectedNotePaths,
      customInstructions: customInstructions.trim() || undefined,
    });
    setCurrentStep(5);
  };

  const handleNext = async () => {
    if (currentStep === 4) {
      await runGeneration();
      return;
    }
    if (currentStep < 5 && canContinue()) setCurrentStep((step) => step + 1);
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0f131c] text-slate-100 -mx-4 sm:-mx-6 lg:-mx-8 -my-6 md:-my-8 px-6 py-6 font-sans overflow-y-auto">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 border-b border-[#334155] pb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-[#c7d2fe]">Assistente de Campanhas</h1>
            <button
              type="button"
              onClick={() => onToggleEngineMode?.(engineMode === "local" ? "gemini" : "local")}
              className="px-2.5 py-1 border border-[#475569] bg-[#182234] text-[10px] font-mono text-slate-400 rounded-sm"
            >
              <span className="text-cyan-400">●</span> Motor IA: {engineMode === "local" ? "Local" : "Gemini"}
            </button>
          </div>
          <span className="text-[10px] font-mono text-slate-500">{campaigns.length} campanhas salvas</span>
        </div>

        <div className="grid grid-cols-5 gap-4 items-start">
          {STEPS.map((step, index) => (
            <div key={step.num} className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => step.num <= currentStep && setCurrentStep(step.num)}
                className={`w-8 h-8 shrink-0 rounded-sm border text-xs font-semibold ${currentStep === step.num ? "bg-[#2563eb] border-blue-500 text-white" : currentStep > step.num ? "bg-[#182234] border-blue-500 text-blue-300" : "bg-[#182234] border-[#475569] text-slate-500"}`}
              >
                {currentStep > step.num ? <Check className="w-4 h-4 mx-auto" /> : step.num}
              </button>
              <div className="min-w-0 flex-1 hidden md:block">
                <div className={`h-px mb-2 ${index === STEPS.length - 1 ? "hidden" : currentStep > step.num ? "bg-blue-500" : "bg-[#475569]"}`} />
                <p className={`text-[10px] font-bold tracking-[0.08em] ${currentStep >= step.num ? "text-slate-300" : "text-slate-600"}`}>{step.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 min-h-[720px]">
          <section className="bg-[#182234] border border-[#334155] border-l-4 border-l-blue-500 rounded-sm flex flex-col min-h-0">
            <div className="h-14 px-5 flex items-center justify-between border-b border-[#334155]">
              <h2 className="text-xl font-semibold">{STEPS[currentStep - 1]?.label === "DEFINIÇÃO" ? "Definição de Objetivo" : STEPS[currentStep - 1]?.label}</h2>
              <span className="text-xs text-slate-400">Etapa {currentStep}/5</span>
            </div>

            <div className="flex-1 p-5 overflow-y-auto">
              {currentStep === 1 && (
                <div className="space-y-7">
                  <Field label="Nome da Campanha"><input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="Ex: Lançamento Q3 - Produto X" className="input-dark" /></Field>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
                    <div>
                      <p className="field-label">Objetivo Principal</p>
                      <div className="flex flex-wrap gap-2 mt-3">{OBJECTIVES.map((item) => <button key={item} onClick={() => setObjective(item)} className={`h-9 px-4 border rounded-sm text-xs ${objective === item ? "border-[#b4c5ff] text-[#c7d2fe] bg-[#1d2a40]" : "border-[#475569] text-slate-400 bg-[#111827]"}`}>{item}</button>)}</div>
                    </div>
                    <div>
                      <p className="field-label">Sugestões rápidas de objetivo</p>
                      <div className="mt-3 space-y-2 text-xs text-slate-300"><Suggestion title="Lançamento de Produto" detail="Criar antecipação e converter leads no dia D." onClick={() => setObjective("Lançamento de Produto")} /><Suggestion title="Nutrição de Base" detail="Reaquecer contatos com conteúdo de valor." onClick={() => setObjective("Nutrição de Base")} /></div>
                    </div>
                  </div>
                  <Field label="Diretrizes Estratégicas"><textarea value={customInstructions} onChange={(event) => setCustomInstructions(event.target.value)} placeholder="Descreva contexto, tom, métricas de sucesso, restrições ou detalhes que a IA deve considerar..." className="textarea-dark min-h-[290px]" /></Field>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-5">
                  <div><p className="field-label">Selecionar contexto do Obsidian</p><p className="text-xs text-slate-500 mt-1">Escolha apenas as notas relevantes para esta campanha. Nenhuma nota é vinculada automaticamente.</p></div>
                  <input value={noteSearch} onChange={(event) => setNoteSearch(event.target.value)} placeholder="Buscar notas..." className="input-dark" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {filteredNotes.length ? filteredNotes.map((note) => {
                      const selected = selectedNotePaths.includes(note.path);
                      return <button key={note.id} onClick={() => toggleNote(note.path)} className={`p-3 border rounded-sm text-left ${selected ? "border-violet-500 bg-violet-950/20" : "border-[#334155] bg-[#111827] hover:border-[#475569]"}`}><div className="flex items-center gap-2"><span className={`w-4 h-4 border flex items-center justify-center ${selected ? "bg-violet-600 border-violet-500" : "border-slate-600"}`}>{selected && <Check className="w-3 h-3" />}</span><span className="text-xs font-semibold truncate">{note.title}</span></div><p className="text-[10px] text-slate-500 mt-2 truncate">{note.path}</p></button>;
                    }) : <div className="md:col-span-2 py-16 text-center text-sm text-slate-500 border border-[#263140]">Nenhuma nota disponível no cofre.</div>}
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-7">
                  <Field label="Público / Persona"><input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Ex: Compradores B2B de empresas médias" className="input-dark" /></Field>
                  <Field label="Tom de Voz"><input value={tone} onChange={(event) => setTone(event.target.value)} placeholder="Ex: Técnico, direto e consultivo" className="input-dark" /></Field>
                  <div><p className="field-label">Canais</p><div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">{CHANNELS.map((channel) => { const selected = selectedChannels.includes(channel); return <button key={channel} onClick={() => toggleChannel(channel)} className={`h-11 border rounded-sm text-xs font-semibold ${selected ? "border-blue-500 bg-[#1d2a40] text-blue-200" : "border-[#334155] bg-[#111827] text-slate-400"}`}>{channel}</button>; })}</div></div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-5">
                  <h3 className="text-lg font-semibold">Prévia antes de gerar</h3>
                  <PreviewRow label="Campanha" value={campaignName || "Não definida"} />
                  <PreviewRow label="Objetivo" value={objective || "Não definido"} />
                  <PreviewRow label="Público" value={audience || "Não informado"} />
                  <PreviewRow label="Tom" value={tone || "Não informado"} />
                  <PreviewRow label="Canais" value={selectedChannels.join(", ") || "Nenhum"} />
                  <PreviewRow label="Notas PKM" value={`${selectedNotePaths.length} selecionadas`} />
                  <div className="bg-[#111827] border border-[#334155] p-4 text-xs text-slate-400 leading-5">A geração usará somente os campos acima e as notas explicitamente selecionadas. Revise antes de continuar.</div>
                </div>
              )}

              {currentStep === 5 && (
                activeCampaign ? (
                  <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4"><div><span className="text-[10px] uppercase tracking-[0.1em] text-emerald-400 font-bold">Resultado gerado</span><h3 className="text-2xl font-semibold mt-2">{activeCampaign.title}</h3><p className="text-sm text-slate-400 leading-6 mt-2 max-w-3xl">{activeCampaign.summary}</p></div><div className="flex gap-2"><button onClick={() => onSaveCampaignToObsidian(activeCampaign)} className="h-9 px-3 border border-violet-500/40 bg-violet-500/10 text-violet-300 text-xs font-semibold">Salvar no Obsidian</button><button onClick={() => onImportCampaignTasks(activeCampaign)} className="h-9 px-3 bg-[#2563eb] text-white text-xs font-semibold">Importar Tarefas</button></div></div>
                    <div className="bg-[#111827] border border-[#334155] p-4"><p className="field-label">Estratégia</p><p className="text-sm text-slate-300 leading-6 mt-3">{activeCampaign.strategy}</p></div>
                    <div className="space-y-3">{activeCampaign.channelsContent?.map((content, index) => <div key={`${content.channel}-${index}`} className="bg-[#111827] border border-[#334155] p-4"><div className="flex items-center justify-between gap-3"><div><span className="text-[10px] uppercase text-cyan-400 font-bold">{content.channel}</span><h4 className="text-sm font-semibold mt-1">{content.title}</h4></div><button onClick={() => copyText(content.copy, `${content.channel}-${index}`)} className="w-8 h-8 border border-[#334155] flex items-center justify-center text-slate-400 hover:text-white"><Copy className="w-4 h-4" /></button></div><p className="text-xs text-slate-400 leading-5 mt-3 whitespace-pre-wrap">{content.copy}</p><p className="text-xs text-blue-300 mt-3">CTA: {content.callToAction}</p>{copiedId === `${content.channel}-${index}` && <p className="text-[10px] text-emerald-400 mt-2">Copiado.</p>}</div>)}</div>
                  </div>
                ) : <div className="py-20 text-center text-slate-500"><Layers className="w-10 h-10 mx-auto" /><p className="mt-3">Nenhum resultado gerado nesta sessão.</p></div>
              )}
            </div>

            <div className="h-16 px-4 border-t border-[#334155] flex items-center justify-between gap-3 shrink-0">
              <button onClick={() => currentStep > 1 ? setCurrentStep((step) => step - 1) : setCampaignName("")} className="h-9 px-4 border border-[#475569] bg-[#182234] text-xs text-slate-300 flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> {currentStep > 1 ? "Voltar" : "Cancelar"}</button>
              {currentStep < 5 ? <button onClick={handleNext} disabled={!canContinue() || isGenerating} className="h-9 px-5 bg-[#2563eb] hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-xs font-semibold flex items-center gap-2">{isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : currentStep === 4 ? <Sparkles className="w-4 h-4" /> : null}{currentStep === 4 ? "Gerar Campanha" : `Continuar para ${STEPS[currentStep]?.label}`}<ArrowRight className="w-4 h-4" /></button> : <button onClick={() => setCurrentStep(1)} className="h-9 px-5 bg-[#2563eb] text-xs font-semibold">Nova Campanha</button>}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="bg-[#182234] border border-[#334155] rounded-sm p-4">
              <h3 className="field-label">Status do Sistema</h3>
              <div className="mt-4 space-y-3">
                <StatusBox icon={<FolderOpen className="w-5 h-5 text-violet-300" />} title="Obsidian Vault" detail={apiConfig.vaultName || "Vault"} active={apiConfig.connectionStatus === "connected"} />
                <StatusBox icon={<Sparkles className="w-5 h-5 text-cyan-300" />} title={`Motor IA (${engineMode === "local" ? "Local" : "Gemini"})`} detail={engineMode === "local" ? "Execução local" : "API configurada"} active />
              </div>
            </div>

            <div className="bg-[#182234] border border-[#334155] rounded-sm p-4 min-h-[360px]">
              <h3 className="field-label">Contexto Vinculado</h3>
              <p className="text-xs text-slate-400 mt-4">{selectedNotePaths.length ? `${selectedNotePaths.length} nota(s) selecionada(s) para esta campanha.` : "Nenhuma nota vinculada nesta etapa. Na etapa Notas PKM você seleciona explicitamente o conhecimento a utilizar."}</p>
              <div className="mt-4 space-y-2">{selectedNotePaths.slice(0, 8).map((path) => <div key={path} className="p-2 border border-[#334155] bg-[#111827] text-[10px] font-mono text-violet-300 truncate">[[{path.replace(/\.md$/, "")}]]</div>)}</div>
            </div>

            {campaigns.length > 0 && <div className="bg-[#182234] border border-[#334155] rounded-sm p-4"><h3 className="field-label">Campanhas Salvas</h3><div className="mt-3 space-y-2">{campaigns.slice(0, 5).map((campaign) => <button key={campaign.id} onClick={() => { setSelectedCampaignId(campaign.id); setCurrentStep(5); }} className="w-full text-left p-2 bg-[#111827] border border-[#334155] hover:border-[#475569] text-xs text-slate-300 truncate">{campaign.title}</button>)}</div></div>}
          </aside>
        </div>
      </div>

      <style>{`.field-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8}.input-dark{width:100%;height:44px;padding:0 14px;background:#0b1018;border:1px solid #475569;color:#e2e8f0;font-size:13px;outline:none;border-radius:2px}.input-dark:focus,.textarea-dark:focus{border-color:#3b82f6}.textarea-dark{width:100%;padding:14px;background:#0b1018;border:1px solid #475569;color:#e2e8f0;font-size:13px;outline:none;border-radius:2px;resize:vertical}`}</style>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <label className="block space-y-3"><span className="field-label">{label}</span>{children}</label>;
const Suggestion: React.FC<{ title: string; detail: string; onClick: () => void }> = ({ title, detail, onClick }) => <button onClick={onClick} className="w-full text-left p-3 bg-[#111827] border border-[#334155] hover:border-[#475569]"><span className="block text-xs text-slate-200">{title}</span><span className="block text-[11px] text-slate-500 mt-1">{detail}</span></button>;
const PreviewRow: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-4 p-3 bg-[#111827] border border-[#334155]"><span className="text-xs text-slate-500">{label}</span><span className="text-xs text-slate-200">{value}</span></div>;
const StatusBox: React.FC<{ icon: React.ReactNode; title: string; detail: string; active: boolean }> = ({ icon, title, detail, active }) => <div className="p-3 bg-[#111827] border border-[#475569] flex items-center gap-3"><span className="w-9 h-9 bg-[#182234] border border-[#334155] flex items-center justify-center">{icon}</span><div className="min-w-0 flex-1"><p className="text-xs text-slate-100">{title}</p><p className="text-[10px] font-mono text-slate-500 truncate">{detail}</p></div><span className={`w-2 h-2 rounded-full ${active ? "bg-emerald-400" : "bg-slate-600"}`} /></div>;
