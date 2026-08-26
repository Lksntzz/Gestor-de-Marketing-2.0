import React, { useState } from "react";
import {
  Sparkles,
  Layers,
  Send,
  Download,
  ExternalLink,
  Copy,
  CheckCircle2,
  Calendar,
  Clock,
  Tag,
  Share2,
  FileText,
  UploadCloud,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Zap,
  Check,
  Search,
  ChevronRight,
  RefreshCw,
  FolderOpen,
  Target,
  Users,
  Compass,
} from "lucide-react";
import { ObsidianNote, MarketingCampaign, ObsidianApiConfig, EngineMode } from "../types";
import { buildObsidianOpenUri, downloadMarkdownFile } from "../utils/obsidianUri";
import confetti from "canvas-confetti";

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
  const [viewMode, setViewMode] = useState<"wizard" | "saved">("wizard");
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedCampaign, setSelectedCampaign] = useState<MarketingCampaign | null>(
    campaigns[0] || null
  );

  // Wizard Form States
  const [campaignName, setCampaignName] = useState("Lançamento Q3 - Growth Engine");
  const [objective, setObjective] = useState("Geração de Leads Qualificados e Demonstrações");
  const [audience, setAudience] = useState("Tech Leads, CTOs e Gestores de Marketing");
  const [tone, setTone] = useState("Autoritário, Técnico, Empático e Direto");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([
    "LinkedIn",
    "Email Newsletter",
    "Blog SEO",
  ]);
  const [selectedNotePaths, setSelectedNotePaths] = useState<string[]>(
    notes.slice(0, 3).map((n) => n.path)
  );
  const [customInstructions, setCustomInstructions] = useState(
    "Enfatizar que o produto respeita o formato Markdown local do Obsidian e não força vendor lock-in."
  );

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [noteSearch, setNoteSearch] = useState("");
  const [activeChannelTab, setActiveChannelTab] = useState<string>(selectedChannels[0] || "LinkedIn");

  const availableChannels = [
    "LinkedIn",
    "Email Newsletter",
    "Instagram",
    "Blog SEO",
    "Twitter / X",
    "TikTok / Reels",
  ];

  const quickObjectives = [
    "Geração de Leads Qualificados",
    "Lançamento de Novo Produto",
    "Construção de Autoridade & Branding",
    "Nutrição e Conversão de Base",
    "Engajamento Orgânico e Retenção",
  ];

  const quickTones = [
    "Autoritário e Direto",
    "Educativo e Prático",
    "Storytelling e Inspirador",
    "Técnico e Analítico",
  ];

  const handleToggleChannel = (channel: string) => {
    if (selectedChannels.includes(channel)) {
      if (selectedChannels.length > 1) {
        const updated = selectedChannels.filter((c) => c !== channel);
        setSelectedChannels(updated);
        if (activeChannelTab === channel) setActiveChannelTab(updated[0]);
      }
    } else {
      setSelectedChannels([...selectedChannels, channel]);
    }
  };

  const handleToggleNotePath = (path: string) => {
    if (selectedNotePaths.includes(path)) {
      setSelectedNotePaths(selectedNotePaths.filter((p) => p !== path));
    } else {
      setSelectedNotePaths([...selectedNotePaths, path]);
    }
  };

  const handleSelectAllNotes = () => {
    if (selectedNotePaths.length === notes.length) {
      setSelectedNotePaths([]);
    } else {
      setSelectedNotePaths(notes.map((n) => n.path));
    }
  };

  const handleRunGeneration = async () => {
    await onGenerateCampaign({
      campaignName,
      objective,
      channels: selectedChannels,
      audience,
      tone,
      selectedNotePaths,
      customInstructions,
    });
    setCurrentStep(5); // Move to Results
    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const search = (noteSearch || "").toLowerCase().trim();
  const filteredNotes = notes.filter(
    (n) =>
      !search ||
      (n.title || "").toLowerCase().includes(search) ||
      (n.folder || "").toLowerCase().includes(search)
  );

  const activeResultCampaign = campaigns[0] || selectedCampaign || null;

  const stepsList = [
    { num: 1, label: "Objetivo" },
    { num: 2, label: "Notas PKM" },
    { num: 3, label: "Persona & Canais" },
    { num: 4, label: "Prévia & Análise" },
    { num: 5, label: "Resultado" },
  ];

  return (
    <div className="w-full px-4 md:px-8 lg:px-12 space-y-6 pb-12 animate-fadeIn">
      
      {/* 1. TOP HEADER & SWITCHER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 uppercase tracking-wider">
              {engineMode === "local" ? "⚡ Motor Local Ativo" : "✨ Assistente IA"}
            </span>
            <span className="text-xs text-stone-400 font-medium">
              {engineMode === "local" ? "0 Tokens • 100% Offline" : "Gemini 3.7"}
            </span>
          </div>
          <h1 className="text-base font-black text-stone-900 tracking-tight mt-1">
            Assistente Guiado de Campanhas
          </h1>
          <p className="text-xs text-stone-500">
            Estruture campanhas multicanais alinhadas com as notas do seu cofre em 4 passos simples.
          </p>
        </div>

        {/* View Switcher: Assistente vs Salvas */}
        <div className="flex items-center bg-stone-100 p-0.5 rounded-xl border border-stone-200 shrink-0">
          <button
            onClick={() => setViewMode("wizard")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              viewMode === "wizard"
                ? "bg-white text-stone-950 shadow-3xs"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Assistente Guiado</span>
          </button>
          <button
            onClick={() => setViewMode("saved")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              viewMode === "saved"
                ? "bg-white text-stone-950 shadow-3xs"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-stone-400" />
            <span>Campanhas Salvas ({campaigns.length})</span>
          </button>
        </div>
      </div>

      {viewMode === "wizard" ? (
        <div className="space-y-6">
          
          {/* 2. PROGRESS BAR & STEP INDICATORS */}
          <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-3xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                Etapa {currentStep} de 5: {stepsList[currentStep - 1]?.label}
              </span>
              <span className="text-xs font-mono font-bold text-purple-700">
                {Math.round((currentStep / 5) * 100)}%
              </span>
            </div>

            {/* Progress Track */}
            <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-stone-900 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${(currentStep / 5) * 100}%` }}
              />
            </div>

            {/* Step Breadcrumbs */}
            <div className="grid grid-cols-5 gap-2 pt-1">
              {stepsList.map((step) => {
                const isCompleted = currentStep > step.num;
                const isCurrent = currentStep === step.num;
                return (
                  <button
                    key={step.num}
                    onClick={() => {
                      if (step.num < currentStep || (step.num === 5 && activeResultCampaign)) {
                        setCurrentStep(step.num);
                      }
                    }}
                    className={`flex items-center gap-1.5 text-left transition-all ${
                      isCurrent
                        ? "text-stone-950 font-bold"
                        : isCompleted
                        ? "text-stone-600 hover:text-stone-900 cursor-pointer"
                        : "text-stone-300 cursor-default"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold ${
                        isCurrent
                          ? "bg-stone-900 text-white"
                          : isCompleted
                          ? "bg-purple-100 text-purple-700"
                          : "bg-stone-100 text-stone-400"
                      }`}
                    >
                      {isCompleted ? <Check className="w-3 h-3" /> : step.num}
                    </span>
                    <span className="text-[11px] truncate hidden md:inline">{step.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. STEP CONTENT CARDS (SINGLE FOCUSED CARD) */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-3xs space-y-6">
            
            {/* STEP 1: DEFINIR OBJETIVO */}
            {currentStep === 1 && (
              <div className="space-y-5 animate-fadeIn">
                <div>
                  <h2 className="text-sm font-black text-stone-900 flex items-center gap-2">
                    <Target className="w-4 h-4 text-purple-600" />
                    <span>Passo 1: Qual o objetivo principal da campanha?</span>
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Defina o título e o propósito para que o motor estruture a tese e a hierarquia de mensagens.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                      Nome da Campanha
                    </label>
                    <input
                      type="text"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="Ex: Lançamento Q3 Growth Engine"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                      Objetivo Principal
                    </label>
                    <input
                      type="text"
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      placeholder="Ex: Geração de Leads / Branding"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20"
                    />
                    
                    {/* Quick chips */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {quickObjectives.map((obj) => (
                        <button
                          key={obj}
                          type="button"
                          onClick={() => setObjective(obj)}
                          className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                            objective === obj
                              ? "bg-purple-50 text-purple-900 border-purple-200"
                              : "bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100"
                          }`}
                        >
                          {obj}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                      Diretrizes Especiais (Opcional)
                    </label>
                    <textarea
                      rows={2}
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      placeholder="Ex: Evitar jargões vazios, enfatizar segurança e formato Markdown local..."
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: SELECIONAR NOTAS DO OBSIDIAN */}
            {currentStep === 2 && (
              <div className="space-y-5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-black text-stone-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-purple-600" />
                      <span>Passo 2: Selecione as Notas do Cofre para Contexto</span>
                    </h2>
                    <p className="text-xs text-stone-500 mt-0.5">
                      O motor cruzará o conteúdo dessas notas para calibrar a copy sem alucinações.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectAllNotes}
                    className="text-[11px] font-bold text-purple-700 hover:underline"
                  >
                    {selectedNotePaths.length === notes.length ? "Desmarcar todas" : "Selecionar todas"}
                  </button>
                </div>

                {/* Quick Search */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Filtrar notas por título ou pasta..."
                    value={noteSearch}
                    onChange={(e) => setNoteSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-800 placeholder-stone-400 focus:border-purple-400"
                  />
                </div>

                {/* Notes List */}
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {filteredNotes.map((note) => {
                    const isSelected = selectedNotePaths.includes(note.path);
                    return (
                      <div
                        key={note.id}
                        onClick={() => handleToggleNotePath(note.path)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? "bg-purple-50/70 border-purple-200 text-stone-950"
                            : "bg-stone-50/50 border-stone-200 hover:bg-stone-100/70 text-stone-600"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent onClick
                            className="rounded text-purple-600 focus:ring-purple-500"
                          />
                          <div className="truncate">
                            <span className="text-xs font-bold block truncate">{note.title}</span>
                            <span className="text-[10px] text-stone-400">{note.folder}</span>
                          </div>
                        </div>
                        <span className="text-[9px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-stone-200 text-stone-500 shrink-0">
                          {note.tags.length > 0 ? `#${note.tags[0]}` : ".md"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="text-[11px] text-stone-500 bg-stone-50 p-3 rounded-xl border border-stone-200/60 flex items-center justify-between">
                  <span>Notas selecionadas para análise: <strong>{selectedNotePaths.length}</strong></span>
                  <span className="text-purple-700 font-bold">✓ Contexto Pronto</span>
                </div>
              </div>
            )}

            {/* STEP 3: DEFINIR PERSONA E CANAL */}
            {currentStep === 3 && (
              <div className="space-y-5 animate-fadeIn">
                <div>
                  <h2 className="text-sm font-black text-stone-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-600" />
                    <span>Passo 3: Defina a Persona, Tom de Voz e Canais</span>
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Adapte a comunicação e os formatos ideais para cada canal de distribuição.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Persona */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                      Público-Alvo / Persona Principal
                    </label>
                    <input
                      type="text"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      placeholder="Ex: Tech Leads, CTOs e Gestores de Marketing"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:border-purple-400"
                    />
                  </div>

                  {/* Tom de Voz */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                      Tom de Voz
                    </label>
                    <input
                      type="text"
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      placeholder="Ex: Autoritário, Técnico, Empático e Direto"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:border-purple-400"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {quickTones.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTone(t)}
                          className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                            tone === t
                              ? "bg-purple-50 text-purple-900 border-purple-200"
                              : "bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Canais de Divulgação */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                      Canais de Divulgação ({selectedChannels.length} selecionados)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {availableChannels.map((channel) => {
                        const isSelected = selectedChannels.includes(channel);
                        return (
                          <button
                            type="button"
                            key={channel}
                            onClick={() => handleToggleChannel(channel)}
                            className={`p-3 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between ${
                              isSelected
                                ? "bg-stone-900 text-white border-stone-900 shadow-3xs"
                                : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                            }`}
                          >
                            <span>{channel}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-stone-300" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: PRÉVIA E ANÁLISE DO MOTOR LOCAL */}
            {currentStep === 4 && (
              <div className="space-y-5 animate-fadeIn">
                <div>
                  <h2 className="text-sm font-black text-stone-900 flex items-center gap-2">
                    <Compass className="w-4 h-4 text-purple-600" />
                    <span>Passo 4: Prévia & Status da Análise Local</span>
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Revise o resumo antes de sintetizar as copies e o cronograma.
                  </p>
                </div>

                {/* Status Box */}
                <div className="bg-stone-900 text-stone-200 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-purple-400" />
                      <span>Status do Motor Local PKM</span>
                    </span>
                    <span className="text-[10px] font-mono text-stone-400">Pronto para execução</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-stone-800/80 p-2.5 rounded-lg border border-stone-700/50">
                      <span className="text-[10px] text-stone-400 block">NOTAS INDEXADAS</span>
                      <strong className="text-white text-sm">{selectedNotePaths.length} notas locais</strong>
                    </div>
                    <div className="bg-stone-800/80 p-2.5 rounded-lg border border-stone-700/50">
                      <span className="text-[10px] text-stone-400 block">CANAIS ALVO</span>
                      <strong className="text-white text-sm">{selectedChannels.length} canais</strong>
                    </div>
                    <div className="bg-stone-800/80 p-2.5 rounded-lg border border-stone-700/50">
                      <span className="text-[10px] text-stone-400 block">FRAMEWORKS</span>
                      <strong className="text-white text-sm">AIDA + PAS</strong>
                    </div>
                  </div>
                </div>

                {/* Campaign Configuration Summary */}
                <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-stone-200/50">
                    <span className="text-stone-500 font-medium">Nome da Campanha:</span>
                    <span className="font-bold text-stone-900">{campaignName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-200/50">
                    <span className="text-stone-500 font-medium">Objetivo:</span>
                    <span className="font-bold text-stone-900">{objective}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-200/50">
                    <span className="text-stone-500 font-medium">Público / Tom:</span>
                    <span className="font-bold text-stone-900">{audience} • {tone}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-stone-500 font-medium">Canais:</span>
                    <span className="font-bold text-purple-800">{selectedChannels.join(", ")}</span>
                  </div>
                </div>

                {/* CTA Action Button */}
                <button
                  type="button"
                  onClick={handleRunGeneration}
                  disabled={isGenerating}
                  className="w-full py-3.5 bg-stone-950 hover:bg-stone-850 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>
                    {isGenerating
                      ? "Sintetizando Estratégia e Copies..."
                      : `Gerar Campanha com ${engineMode === "local" ? "Motor Local" : "IA"}`}
                  </span>
                </button>
              </div>
            )}

            {/* STEP 5: RESULTADO DA CAMPANHA */}
            {currentStep === 5 && activeResultCampaign && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 uppercase">
                      ✓ Campanha Gerada com Sucesso
                    </span>
                    <h2 className="text-base font-black text-stone-900 mt-1">
                      {activeResultCampaign.title}
                    </h2>
                    <p className="text-xs text-stone-500 mt-0.5">{activeResultCampaign.strategy}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSaveCampaignToObsidian(activeResultCampaign)}
                      className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Salvar no Obsidian</span>
                    </button>
                    <button
                      onClick={() =>
                        downloadMarkdownFile(
                          activeResultCampaign.title,
                          `# ${activeResultCampaign.title}\n\n## Estratégia\n${activeResultCampaign.strategy}\n\n## Resumo\n${activeResultCampaign.summary}`
                        )
                      }
                      className="p-1.5 text-stone-600 hover:text-stone-900 border border-stone-200 rounded-lg hover:bg-stone-50"
                      title="Baixar .md"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Channel Switcher Tabs */}
                <div className="flex flex-wrap gap-1.5 border-b border-stone-150 pb-2">
                  {activeResultCampaign.channelsContent.map((item) => (
                    <button
                      key={item.channel}
                      onClick={() => setActiveChannelTab(item.channel)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        activeChannelTab === item.channel
                          ? "bg-purple-600 text-white shadow-3xs"
                          : "bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200/50"
                      }`}
                    >
                      {item.channel}
                    </button>
                  ))}
                </div>

                {/* Active Channel Copy */}
                {activeResultCampaign.channelsContent
                  .filter((item) => item.channel === activeChannelTab)
                  .map((item, idx) => (
                    <div key={idx} className="space-y-4 bg-stone-50/50 p-4 rounded-xl border border-stone-200/70">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-stone-900">{item.title}</h4>
                          {item.suggestedPublishDate && (
                            <span className="text-[10px] text-stone-400 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3 text-stone-400" />
                              <span>Data sugerida: {item.suggestedPublishDate}</span>
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleCopyText(item.copy, `${activeResultCampaign.id}-${idx}`)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-100 transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedId === `${activeResultCampaign.id}-${idx}` ? "Copiado!" : "Copiar"}</span>
                        </button>
                      </div>

                      <pre className="whitespace-pre-wrap font-sans text-xs text-stone-850 bg-white p-4 rounded-xl border border-stone-200 leading-relaxed shadow-3xs">
                        {item.copy}
                      </pre>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                        <div className="text-stone-600">
                          <strong>Call to Action:</strong> <span className="text-purple-700 font-bold">{item.callToAction}</span>
                        </div>
                        {item.hashtagsOrKeywords && item.hashtagsOrKeywords.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.hashtagsOrKeywords.map((tag) => (
                              <span key={tag} className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200/50">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                {/* Restart Wizard Action */}
                <div className="pt-2 flex items-center justify-between">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="text-xs font-bold text-purple-700 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Criar Outra Campanha</span>
                  </button>
                  <button
                    onClick={() => setViewMode("saved")}
                    className="text-xs font-bold text-stone-600 hover:text-stone-900"
                  >
                    Ver todas as campanhas salvas →
                  </button>
                </div>
              </div>
            )}

            {/* STEP NAVIGATION BUTTONS (FOOTER) */}
            {currentStep < 5 && (
              <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
                  disabled={currentStep === 1}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar</span>
                </button>

                {currentStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((prev) => Math.min(4, prev + 1))}
                    className="px-5 py-2 text-xs font-bold text-white bg-stone-950 hover:bg-stone-850 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Avançar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>
            )}

          </div>

        </div>
      ) : (
        /* SAVED CAMPAIGNS VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fadeIn">
          {/* Left: Campaign List (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-stone-200 p-4 shadow-3xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Campanhas Salvas
              </span>
              <button
                onClick={() => {
                  setViewMode("wizard");
                  setCurrentStep(1);
                }}
                className="text-xs text-purple-600 hover:text-purple-800 font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova</span>
              </button>
            </div>

            <div className="space-y-2">
              {campaigns.map((camp) => {
                const isSelected = selectedCampaign?.id === camp.id;
                return (
                  <div
                    key={camp.id}
                    onClick={() => setSelectedCampaign(camp)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? "bg-purple-50/70 border-purple-300 shadow-3xs"
                        : "border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                        {camp.status}
                      </span>
                      <span className="text-[10px] text-stone-400">{camp.createdDate}</span>
                    </div>
                    <h3 className="text-xs font-bold text-stone-900 mt-1 line-clamp-1">
                      {camp.title}
                    </h3>
                    <p className="text-[11px] text-stone-500 mt-0.5 line-clamp-1">{camp.objective}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Selected Campaign Details (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {selectedCampaign ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-3xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                  <div>
                    <h2 className="text-base font-black text-stone-900">{selectedCampaign.title}</h2>
                    <p className="text-xs text-stone-500 mt-0.5">{selectedCampaign.strategy}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSaveCampaignToObsidian(selectedCampaign)}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Salvar no Obsidian</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedCampaign.channelsContent.map((item, idx) => (
                    <div key={idx} className="p-4 bg-stone-50 rounded-xl border border-stone-200/70 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                          {item.channel}
                        </span>
                        <button
                          onClick={() => handleCopyText(item.copy, `saved-${idx}`)}
                          className="text-[11px] font-bold text-stone-600 hover:text-stone-900 flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedId === `saved-${idx}` ? "Copiado!" : "Copiar"}</span>
                        </button>
                      </div>
                      <h4 className="text-xs font-bold text-stone-900">{item.title}</h4>
                      <pre className="whitespace-pre-wrap font-sans text-xs text-stone-850 bg-white p-3 rounded-lg border border-stone-200">
                        {item.copy}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-stone-400 text-xs">
                Selecione uma campanha para visualizar os detalhes.
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
