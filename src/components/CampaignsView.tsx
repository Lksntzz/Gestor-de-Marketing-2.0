import React, { useState, useMemo } from "react";
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
  ShoppingCart,
  Eye,
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
  const [viewMode, setViewMode] = useState<"wizard" | "saved">("wizard");
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isGeneratingGuidelines, setIsGeneratingGuidelines] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<MarketingCampaign | null>(
    campaigns[0] || null
  );

  // Wizard Form States
  const [campaignName, setCampaignName] = useState("Lançamento Coleção Planners & Devocionais 2026");
  const [objective, setObjective] = useState("Captação de Papelarias Criativas e Pedidos B2B");
  const [audience, setAudience] = useState("Empreendedoras de Papelaria, Líderes Ministeriais e Autores");
  const [tone, setTone] = useState("Inspirador, Sofisticado, Técnico e Acolhedor");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([
    "Instagram",
    "WhatsApp VIP",
    "Email Newsletter",
  ]);
  const [selectedNotePaths, setSelectedNotePaths] = useState<string[]>(
    notes.slice(0, 2).map((n) => n.path)
  );
  const [customInstructions, setCustomInstructions] = useState(
    "Destacar que produzimos tiragens a partir de 10 unidades com laminação Soft Touch, miolo 90g e encadernação wire-o bronze."
  );

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [noteSearch, setNoteSearch] = useState("");
  const [activeChannelTab, setActiveChannelTab] = useState<string>("Instagram");

  const availableChannels = [
    "Instagram",
    "WhatsApp VIP",
    "Email Newsletter",
    "TikTok / Reels",
    "LinkedIn B2B",
    "Blog Editorial",
  ];

  const quickObjectives = [
    "Captação de Papelarias (B2B)",
    "Lançamento de Nova Coleção",
    "Pedidos Antecipados",
    "Divulgação de Brindes",
    "Fortalecimento de Marca",
  ];

  const quickTones = [
    "Inspirador e Sofisticado",
    "Acolhedor e Especialista",
    "Técnico e Direto",
    "Comercial e Persuasivo",
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

  const handleGenerateGuidelines = async () => {
    setIsGeneratingGuidelines(true);
    try {
      const res = await api.generateGuidelines({
        campaignName: campaignName,
        objective: objective,
        engineMode: apiConfig.engineMode,
      });
      if (res.data?.guidelines) {
        setCustomInstructions(res.data.guidelines);
      } else {
        setCustomInstructions("Destacar que produzimos tiragens a partir de 10 unidades com laminação Soft Touch, miolo 90g e encadernação wire-o bronze. Evitar jargões genéricos, priorizando tom de boutique especializada.");
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Falha ao gerar diretrizes com IA");
    } finally {
      setIsGeneratingGuidelines(false);
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
    { num: 1, label: "Definição" },
    { num: 2, label: "Notas PKM" },
    { num: 3, label: "Canais" },
    { num: 4, label: "Prévia" },
    { num: 5, label: "Resultado" },
  ];

  return (
    <div className="w-full h-full flex flex-col gap-4 animate-fadeIn font-sans min-h-0">
      
      {/* 1. TOP HEADER & SWITCHER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 shrink-0 border-b border-outline-border">
        <div>
          <h1 className="text-2xl font-black text-text-primary tracking-tight mt-1.5">
            {viewMode === "wizard" ? "Assistente Guiado de Campanhas" : "Histórico de Campanhas"}
          </h1>
          <p className="text-xs text-text-secondary">
            {viewMode === "wizard" 
              ? "Estruture campanhas multicanais alinhadas com as notas do seu cofre em passos táticos simples."
              : "Acesse e exporte os planejamentos estruturados e copies gerados anteriormente."}
          </p>
        </div>

        {/* View Switcher: Assistente vs Salvas */}
        <div className="flex items-center bg-[#1c2028] p-1 rounded-xl border border-outline-border shrink-0 self-start sm:self-center">
          <button
            onClick={() => setViewMode("wizard")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              viewMode === "wizard"
                ? "bg-primary-container text-white shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span>Assistente Criador</span>
          </button>
          <button
            onClick={() => setViewMode("saved")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              viewMode === "saved"
                ? "bg-primary-container text-white shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Campanhas Salvas ({campaigns.length})</span>
          </button>
        </div>
      </div>

      {viewMode === "wizard" ? (
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          
          {/* 2. PROGRESS BAR & STEP INDICATORS */}
          <div className="w-full shrink-0 flex items-center justify-between relative px-4 sm:px-8 py-3 bg-background">
            <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-[2px] bg-outline-border z-0"></div>
            <div 
              className="absolute left-8 top-1/2 -translate-y-1/2 h-[2px] bg-primary-container z-0 transition-all duration-500"
              style={{ right: `${Math.max(0, 100 - (currentStep / 5) * 100)}%` }}
            ></div>
            
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
                  className="relative z-10 flex flex-col items-center gap-1 bg-background px-2 sm:px-4 focus:outline-none cursor-pointer group"
                  disabled={step.num > currentStep && !(step.num === 5 && activeResultCampaign)}
                >
                  <div 
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-[0_0_0_4px_#0f131c] transition-all duration-300 ${
                      isCurrent 
                        ? "bg-primary-container text-white" 
                        : isCompleted 
                        ? "bg-success-sober text-[#0f131c]" 
                        : "bg-surface-container-low text-text-secondary border border-outline-border"
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4 font-bold" /> : step.num}
                  </div>
                  <span 
                    className={`text-[10px] font-bold tracking-wider uppercase transition-colors duration-300 ${
                      isCurrent 
                        ? "text-primary-fixed-dim" 
                        : isCompleted 
                        ? "text-success-sober" 
                        : "text-text-secondary"
                    }`}
                  >
                    {step.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 3. MAIN DUAL-COLUMN LAYOUT (FORM + CONTEXT SIDEBAR) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
            
            {/* Left Column (Main Form Card) */}
            <div className="lg:col-span-8 flex flex-col bg-surface-card border border-outline-border rounded-xl relative overflow-hidden h-full shadow-lg">
              <div className="absolute left-0 top-0 w-1 h-full bg-primary-container z-20"></div>
              
              {/* Form Header */}
              <div className="px-6 py-4 border-b border-outline-border bg-surface-card shrink-0 flex justify-between items-center z-10">
                <h2 className="text-base font-bold text-text-primary">
                  {currentStep === 1 && "Definição de Objetivo"}
                  {currentStep === 2 && "Conexão de Notas PKM"}
                  {currentStep === 3 && "Público-Alvo, Tom & Canais"}
                  {currentStep === 4 && "Prévia do Plano de Campanha"}
                  {currentStep === 5 && "Resultado da Geração"}
                </h2>
                <span className="font-mono text-xs text-text-secondary">
                  Etapa {currentStep}/5
                </span>
              </div>

              {/* Scrollable Form Content */}
              <div className="flex-1 overflow-y-auto no-scrollbar p-6 flex flex-col gap-6">
                
                {/* STEP 1: DEFINIR OBJETIVO */}
                {currentStep === 1 && (
                  <div className="space-y-6 animate-fadeIn">
                    
                    {/* Input Name */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider" htmlFor="campaign_name">
                        Nome da Campanha
                      </label>
                      <input
                        id="campaign_name"
                        type="text"
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        placeholder="Ex: Lançamento Q3 - Produto X"
                        className="w-full bg-surface-container-lowest border border-outline-border rounded-xl px-4 py-2.5 text-text-primary text-xs font-semibold focus:outline-none focus:border-motor-info focus:ring-1 focus:ring-motor-info transition-colors placeholder:text-text-secondary/40"
                      />
                    </div>

                    {/* Objective Column & Suggestions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Objective selection */}
                      <div className="flex flex-col gap-3">
                        <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                          Objetivo Principal
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: "Lead Gen", label: "Lead Gen", icon: Target },
                            { id: "Sales", label: "Vendas (Sales)", icon: ShoppingCart },
                            { id: "Branding", label: "Marca (Branding)", icon: Eye },
                            { id: "Retenção", label: "Retenção", icon: RefreshCw },
                          ].map((item) => {
                            const Icon = item.icon;
                            const isSelected = objective.toLowerCase().includes(item.id.toLowerCase()) || objective === item.label;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setObjective(item.label)}
                                className={`px-4 py-2.5 rounded-xl border transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
                                  isSelected
                                    ? "bg-primary-container/20 border-primary-container text-primary-fixed-dim shadow-xs"
                                    : "bg-surface-container-lowest border-outline-border text-text-secondary hover:border-outline hover:text-text-primary"
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{item.id}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Suggestions column */}
                      <div className="flex flex-col gap-3">
                        <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                          Sugestões Rápidas de Objetivo
                        </label>
                        <div className="grid grid-cols-1 gap-2.5">
                          {[
                            {
                              title: "Lançamento de Produto",
                              desc: "Criar antecipação e converter leads no dia de abertura do carrinho.",
                              objective: "Lançamento de Nova Coleção de Planners",
                              campName: "Lançamento Coleção Planners & Devocionais 2026",
                            },
                            {
                              title: "Nutrição de Base",
                              desc: "Reaquecer contatos B2B com conteúdo de valor e catálogos atualizados.",
                              objective: "Captação de Papelarias Criativas e Pedidos B2B",
                              campName: "Campanha B2B - Papelarias e Revendedores 2026",
                            },
                          ].map((sug, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                setObjective(sug.objective);
                                setCampaignName(sug.campName);
                              }}
                              className="p-3 border border-outline-border rounded-xl bg-surface-container-low cursor-pointer hover:border-primary-container hover:bg-surface-elevated transition-all flex flex-col gap-1"
                            >
                              <span className="text-xs font-bold text-text-primary">{sug.title}</span>
                              <span className="text-[11px] text-text-secondary leading-tight">{sug.desc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Textarea: Strategic guidelines */}
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider" htmlFor="strategic_guidelines">
                          Diretrizes Estratégicas
                        </label>
                        <button
                          type="button"
                          onClick={handleGenerateGuidelines} disabled={isGeneratingGuidelines}
                          className="text-motor-info hover:text-tertiary text-[10px] flex items-center gap-1 font-mono bg-surface-container-high px-2.5 py-1 rounded-lg border border-outline-border transition-colors cursor-pointer"
                        >
                          {isGeneratingGuidelines ? (
                            <Loader2 className="w-3 h-3 text-motor-info animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3 text-motor-info animate-pulse" />
                          )}
                          <span>{isGeneratingGuidelines ? "Gerando..." : "Gerar com IA"}</span>
                        </button>
                      </div>
                      <textarea
                        id="strategic_guidelines"
                        rows={6}
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        placeholder="Descreva o contexto detalhado, tom de voz específico, métricas de sucesso desejadas, e quaisquer restrições ou detalhes que a IA deve considerar ao estruturar esta campanha..."
                        className="w-full bg-surface-container-lowest border border-outline-border rounded-xl px-4 py-3 text-motor-info font-mono text-xs focus:outline-none focus:border-motor-info focus:ring-1 focus:ring-motor-info transition-colors resize-none placeholder:text-text-secondary/40 shadow-inner"
                      />
                    </div>

                  </div>
                )}

                {/* STEP 2: SELECIONAR NOTAS DO OBSIDIAN */}
                {currentStep === 2 && (
                  <div className="space-y-5 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-primary-fixed-dim" />
                          <span>Vincule o Conhecimento do seu Cofre</span>
                        </h3>
                        <p className="text-[11px] text-text-secondary mt-1">
                          O motor IA analisará o conteúdo das notas selecionadas para gerar copies extremamente alinhados e sem alucinações.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleSelectAllNotes}
                        className="text-[11px] font-bold text-primary-fixed-dim hover:underline cursor-pointer"
                      >
                        {selectedNotePaths.length === notes.length ? "Desmarcar todas" : "Selecionar todas"}
                      </button>
                    </div>

                    {/* Quick Search */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                      <input
                        type="text"
                        placeholder="Filtrar notas por título ou pasta..."
                        value={noteSearch}
                        onChange={(e) => setNoteSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-surface-container-lowest border border-outline-border rounded-xl text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-primary-container"
                      />
                    </div>

                    {/* Notes Selection Grid */}
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      {filteredNotes.map((note) => {
                        const isSelected = selectedNotePaths.includes(note.path);
                        return (
                          <div
                            key={note.id}
                            onClick={() => handleToggleNotePath(note.path)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? "bg-primary-container/10 border-primary-container text-text-primary"
                                : "bg-surface-container-low border-outline-border hover:bg-surface-elevated text-text-secondary"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                isSelected ? "bg-primary-container border-primary-container text-white" : "border-outline-border"
                              }`}>
                                {isSelected && <Check className="w-3 h-3 font-bold" />}
                              </div>
                              <div className="truncate">
                                <span className="text-xs font-bold block truncate text-text-primary">{note.title}</span>
                                <span className="text-[10px] text-text-secondary">{note.folder}</span>
                              </div>
                            </div>
                            <span className="text-[9px] font-mono font-bold bg-surface-card px-2 py-0.5 rounded border border-outline-border text-text-secondary shrink-0">
                              {note.tags && note.tags.length > 0 ? `#${note.tags[0]}` : ".md"}
                            </span>
                          </div>
                        );
                      })}
                      {filteredNotes.length === 0 && (
                        <p className="text-center py-8 text-xs text-text-secondary">Nenhuma nota encontrada no cofre.</p>
                      )}
                    </div>

                    <div className="text-[11px] text-text-secondary bg-surface-container-low p-3.5 rounded-xl border border-outline-border flex items-center justify-between">
                      <span>Notas selecionadas para análise: <strong className="text-text-primary">{selectedNotePaths.length}</strong></span>
                      <span className="text-success-sober font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-success-sober" />
                        Contexto Pronto
                      </span>
                    </div>
                  </div>
                )}

                {/* STEP 3: DEFINIR PERSONA E CANAIS */}
                {currentStep === 3 && (
                  <div className="space-y-6 animate-fadeIn">
                    
                    {/* Persona Target */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                        Público-Alvo / Persona Principal
                      </label>
                      <input
                        type="text"
                        value={audience}
                        onChange={(e) => setAudience(e.target.value)}
                        placeholder="Ex: Empreendedoras de Papelaria, Líderes Ministeriais e Autores"
                        className="w-full bg-surface-container-lowest border border-outline-border rounded-xl px-4 py-2.5 text-text-primary text-xs font-semibold focus:outline-none focus:border-primary-container"
                      />
                    </div>

                    {/* Tom de Voz */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                        Tom de Voz da Campanha
                      </label>
                      <input
                        type="text"
                        value={tone}
                        onChange={(e) => setTone(e.target.value)}
                        placeholder="Ex: Inspirador, Sofisticado, Técnico e Acolhedor"
                        className="w-full bg-surface-container-lowest border border-outline-border rounded-xl px-4 py-2.5 text-text-primary text-xs font-semibold focus:outline-none focus:border-primary-container"
                      />
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {quickTones.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTone(t)}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                              tone === t
                                ? "bg-primary-container/20 text-primary-fixed-dim border-primary-container"
                                : "bg-surface-container-low text-text-secondary border-outline-border hover:bg-surface-elevated"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Channels grid selector */}
                    <div className="flex flex-col gap-3">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                        Canais de Divulgação ({selectedChannels.length} selecionados)
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {availableChannels.map((channel) => {
                          const isSelected = selectedChannels.includes(channel);
                          return (
                            <button
                              type="button"
                              key={channel}
                              onClick={() => handleToggleChannel(channel)}
                              className={`p-3.5 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                                isSelected
                                  ? "bg-primary-container text-white border-primary-container shadow-xs"
                                  : "bg-surface-container-low text-text-secondary border-outline-border hover:bg-surface-elevated"
                              }`}
                            >
                              <span>{channel}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                )}

                {/* STEP 4: PRÉVIA E REVISÃO */}
                {currentStep === 4 && (
                  <div className="space-y-5 animate-fadeIn">
                    
                    {/* Status Box */}
                    <div className="bg-[#0a0e16] border border-outline-border p-4.5 rounded-xl space-y-3.5">
                      <div className="flex items-center justify-between pb-2 border-b border-outline-border/60">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary-fixed-dim flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5" />
                          <span>Status de Análise do Motor IA</span>
                        </span>
                        <span className="text-[9px] font-mono text-success-sober bg-success-sober/10 px-2 py-0.5 rounded border border-success-sober/20">Pronto para execução</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="bg-surface-card p-3 rounded-lg border border-outline-border">
                          <span className="text-[10px] text-text-secondary block">NOTAS VINCULADAS</span>
                          <strong className="text-text-primary text-xs mt-1 block">{selectedNotePaths.length} notas locais</strong>
                        </div>
                        <div className="bg-surface-card p-3 rounded-lg border border-outline-border">
                          <span className="text-[10px] text-text-secondary block">CANAIS ALVO</span>
                          <strong className="text-text-primary text-xs mt-1 block">{selectedChannels.length} canais ativos</strong>
                        </div>
                        <div className="bg-surface-card p-3 rounded-lg border border-outline-border">
                          <span className="text-[10px] text-text-secondary block">MODELOS LÓGICOS</span>
                          <strong className="text-text-primary text-xs mt-1 block">Framework AIDA + PAS</strong>
                        </div>
                      </div>
                    </div>

                    {/* Configuration Summary Table */}
                    <div className="p-4 bg-surface-container-low border border-outline-border rounded-xl space-y-2.5 text-xs">
                      <div className="flex justify-between py-1.5 border-b border-outline-border/40">
                        <span className="text-text-secondary font-medium">Nome da Campanha:</span>
                        <span className="font-bold text-text-primary text-right">{campaignName}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-outline-border/40">
                        <span className="text-text-secondary font-medium">Objetivo:</span>
                        <span className="font-bold text-text-primary text-right">{objective}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-outline-border/40">
                        <span className="text-text-secondary font-medium">Público da Persona:</span>
                        <span className="font-bold text-text-primary text-right">{audience}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-outline-border/40">
                        <span className="text-text-secondary font-medium">Tom de Voz:</span>
                        <span className="font-bold text-text-primary text-right">{tone}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-text-secondary font-medium">Canais Selecionados:</span>
                        <span className="font-bold text-primary-fixed-dim text-right">{selectedChannels.join(", ")}</span>
                      </div>
                    </div>

                  </div>
                )}

                {/* STEP 5: RESULTADO DO CONTEÚDO GERADO */}
                {currentStep === 5 && activeResultCampaign && (
                  <div className="space-y-6 animate-fadeIn">
                    
                    {/* Success Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-outline-border/60">
                      <div>
                        <span className="text-[9px] font-bold text-success-sober bg-success-sober/10 px-2.5 py-0.5 rounded border border-success-sober/20 uppercase tracking-wider">
                          ✓ Campanha Gerada com Sucesso
                        </span>
                        <h2 className="text-lg font-black text-text-primary mt-1.5">
                          {activeResultCampaign.title}
                        </h2>
                        <p className="text-xs text-text-secondary mt-1">{activeResultCampaign.strategy}</p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                        <button
                          onClick={() => onSaveCampaignToObsidian(activeResultCampaign)}
                          className="px-3.5 py-2 bg-primary-container hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <UploadCloud className="w-3.5 h-3.5 text-white" />
                          <span>Salvar no Obsidian</span>
                        </button>
                        <button
                          onClick={() =>
                            downloadMarkdownFile(
                              activeResultCampaign.title,
                              `# ${activeResultCampaign.title}\n\n## Estratégia\n${activeResultCampaign.strategy}\n\n## Resumo\n${activeResultCampaign.summary}`
                            )
                          }
                          className="p-2 text-text-secondary hover:text-text-primary border border-outline-border rounded-xl bg-surface-container-low hover:bg-surface-elevated transition-colors cursor-pointer"
                          title="Baixar Markdown .md"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Copy Channels Switcher tabs */}
                    <div className="flex flex-wrap gap-1.5 border-b border-outline-border pb-2">
                      {activeResultCampaign.channelsContent.map((item) => (
                        <button
                          key={item.channel}
                          onClick={() => setActiveChannelTab(item.channel)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            activeChannelTab === item.channel
                              ? "bg-primary-container text-white shadow-sm"
                              : "bg-surface-container-low text-text-secondary border border-outline-border hover:bg-surface-elevated"
                          }`}
                        >
                          {item.channel}
                        </button>
                      ))}
                    </div>

                    {/* Active Copy details */}
                    {activeResultCampaign.channelsContent
                      .filter((item) => item.channel === activeChannelTab)
                      .map((item, idx) => (
                        <div key={idx} className="space-y-4 bg-surface-container-low p-4.5 rounded-xl border border-outline-border">
                          
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-black text-text-primary">{item.title}</h4>
                              {item.suggestedPublishDate && (
                                <span className="text-[10px] text-text-secondary flex items-center gap-1 mt-1 font-mono">
                                  <Calendar className="w-3 h-3 text-text-secondary" />
                                  <span>Data de Publicação Sugerida: {item.suggestedPublishDate}</span>
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleCopyText(item.copy, `${activeResultCampaign.id}-${idx}`)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-text-primary bg-surface-card border border-outline-border rounded-lg hover:bg-surface-elevated transition-colors cursor-pointer"
                            >
                              <Copy className="w-3 h-3 text-primary-fixed-dim" />
                              <span>{copiedId === `${activeResultCampaign.id}-${idx}` ? "Copiado!" : "Copiar"}</span>
                            </button>
                          </div>

                          <pre className="whitespace-pre-wrap font-sans text-xs text-text-primary bg-surface-card p-4 rounded-xl border border-outline-border leading-relaxed font-sans shadow-inner">
                            {item.copy}
                          </pre>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-xs border-t border-outline-border/40">
                            <div>
                              <strong className="text-text-secondary">Call to Action:</strong>{" "}
                              <span className="text-primary-fixed-dim font-bold">{item.callToAction}</span>
                            </div>
                            {item.hashtagsOrKeywords && item.hashtagsOrKeywords.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {item.hashtagsOrKeywords.map((tag) => (
                                  <span key={tag} className="text-[10px] font-bold text-text-secondary bg-[#1c2028] px-2 py-0.5 rounded border border-outline-border/60">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                    {/* Restart campaign wizard */}
                    <div className="pt-2 border-t border-outline-border/40 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setCampaignName("");
                          setObjective("");
                          setSelectedChannels(["Instagram"]);
                          setSelectedNotePaths([]);
                          setCustomInstructions("");
                          setCurrentStep(1);
                        }}
                        className="text-xs font-bold text-primary-fixed-dim hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Criar Outra Campanha</span>
                      </button>
                      <button
                        onClick={() => setViewMode("saved")}
                        className="text-xs font-bold text-text-secondary hover:text-text-primary cursor-pointer"
                      >
                        Ver todas as campanhas salvas →
                      </button>
                    </div>

                  </div>
                )}

              </div>

              {/* Sticky Footer Action Bar */}
              {currentStep < 5 && (
                <div className="p-4 border-t border-outline-border bg-surface-card shrink-0 flex justify-between items-center z-10">
                  <button
                    type="button"
                    onClick={() => {
                      if (currentStep > 1) {
                        setCurrentStep((prev) => prev - 1);
                      } else {
                        setViewMode("saved");
                      }
                    }}
                    className="px-4 py-2 rounded-xl border border-outline-border text-text-secondary hover:bg-surface-elevated hover:text-text-primary transition-colors text-xs font-bold cursor-pointer"
                  >
                    {currentStep === 1 ? "Cancelar" : "Voltar"}
                  </button>
                  
                  {currentStep < 4 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentStep((prev) => Math.min(4, prev + 1));
                      }}
                      className="px-5 py-2 rounded-xl bg-primary-container hover:bg-blue-600 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <span>
                        {currentStep === 1 && "Continuar para Notas PKM"}
                        {currentStep === 2 && "Continuar para Canais"}
                        {currentStep === 3 && "Continuar para Prévia"}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRunGeneration}
                      disabled={isGenerating}
                      className="px-5 py-2 rounded-xl bg-primary-container hover:bg-blue-600 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Sintetizando...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Sintetizar Estratégia</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

            </div>

            {/* Right Column: Context & Status Sidebar (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-4 min-h-0 overflow-y-auto no-scrollbar">
              
              {/* Panel 1: System Status */}
              <div className="bg-surface-card border border-outline-border rounded-xl p-4 flex flex-col gap-3 shadow-sm">
                <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-wider border-b border-outline-border pb-2">
                  Status do Sistema
                </h3>
                
                {/* Obsidian Connection Status */}
                <div className="flex items-center justify-between bg-surface-container-low p-3 rounded-xl border border-outline-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                      <FolderOpen className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-xs text-text-primary truncate">Obsidian Vault</span>
                      <span className="font-mono text-[9px] text-text-secondary truncate">
                        {apiConfig.connectionStatus === "connected" ? `/${apiConfig.vaultName}` : "Cofre Desconectado"}
                      </span>
                    </div>
                  </div>
                  <div 
                    className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all ${
                      apiConfig.connectionStatus === "connected" 
                        ? "bg-success-sober shadow-[0_0_8px_rgba(16,185,129,0.4)]" 
                        : "bg-error-sober"
                    }`}
                  />
                </div>

                {/* IA Engine Status */}
                <div className="flex items-center justify-between bg-surface-container-low p-3 rounded-xl border border-outline-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-motor-info shrink-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-xs text-text-primary truncate">
                        {engineMode === "local" ? "Motor IA: Local" : "Motor IA: Gemini"}
                      </span>
                      <span className="font-mono text-[9px] text-text-secondary truncate">
                        {engineMode === "local" ? "Context Window: 8k • Offline" : "Context Window: 2M • Nuvem"}
                      </span>
                    </div>
                  </div>
                  <div 
                    className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all ${
                      engineMode === "local" 
                        ? "bg-success-sober shadow-[0_0_8px_rgba(16,185,129,0.4)]" 
                        : "bg-motor-info shadow-[0_0_8px_rgba(56,189,248,0.4)]"
                    }`}
                  />
                </div>
              </div>

              {/* Panel 2: Connected Context */}
              <div className="bg-surface-card border border-outline-border rounded-xl p-4 flex flex-col gap-3 shadow-sm flex-1">
                <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-wider border-b border-outline-border pb-2">
                  Contexto Vinculado
                </h3>
                
                {currentStep === 1 ? (
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Nenhuma nota vinculada nesta etapa. Na próxima etapa (Notas PKM) você selecionará o conhecimento a ser utilizado.
                  </p>
                ) : selectedNotePaths.length === 0 ? (
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Nenhuma nota selecionada para esta campanha. A IA usará diretrizes gerais sem contexto do cofre.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {selectedNotePaths.map((path) => {
                      const note = notes.find((n) => n.path === path);
                      if (!note) return null;
                      return (
                        <div 
                          key={path} 
                          className="flex items-center gap-2.5 bg-surface-container-low p-2.5 rounded-xl border border-outline-border"
                        >
                          <FileText className="w-4 h-4 text-primary-fixed-dim" />
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-xs text-text-primary truncate">[[{note.title}]]</span>
                            <span className="font-mono text-[9px] text-text-secondary truncate">{note.folder}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {currentStep === 1 && (
                  <div 
                    onClick={() => setCurrentStep(2)}
                    className="mt-2 p-4 border border-dashed border-outline-variant rounded-xl bg-[#0a0e16] flex flex-col items-center justify-center gap-2 text-text-secondary cursor-pointer hover:border-primary-container hover:text-text-primary transition-colors flex-1 min-h-[150px]"
                  >
                    <div className="w-8 h-8 rounded-full bg-surface-card flex items-center justify-center border border-outline-border">
                      <Plus className="w-4 h-4 text-text-secondary" />
                    </div>
                    <span className="text-xs text-center leading-normal">
                      Vincular nota [[Wiki]] manualmente
                      <br />
                      <span className="text-[10px] opacity-70">(Opcional nesta etapa)</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      ) : (
        /* SAVED CAMPAIGNS VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fadeIn">
          
          {/* Left: Campaign List (4 cols) */}
          <div className="lg:col-span-4 bg-surface-card rounded-xl border border-outline-border p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-outline-border/40">
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Campanhas Salvas
              </span>
              <button
                onClick={() => {
                  setViewMode("wizard");
                  setCurrentStep(1);
                }}
                className="text-xs text-primary-fixed-dim hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova</span>
              </button>
            </div>

            <div className="space-y-2 max-h-[520px] overflow-y-auto no-scrollbar">
              {campaigns.length === 0 ? (
                <div className="p-8 text-center text-xs text-text-secondary space-y-2">
                  <p>Nenhuma campanha criada ainda.</p>
                  <button
                    onClick={() => {
                      setViewMode("wizard");
                      setCurrentStep(1);
                    }}
                    className="px-3.5 py-1.5 bg-primary-container text-white font-bold rounded-lg text-xs hover:bg-blue-600 transition-colors cursor-pointer"
                  >
                    Criar Primeira Campanha
                  </button>
                </div>
              ) : (
                campaigns.map((camp) => {
                  const isSelected = selectedCampaign?.id === camp.id;
                  return (
                    <div
                      key={camp.id}
                      onClick={() => setSelectedCampaign(camp)}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all mb-2 ${
                        isSelected
                           ? "bg-primary-container/10 border-primary-container text-text-primary shadow-xs"
                           : "border-outline-border bg-[#0a0e16] text-text-secondary hover:border-outline-border/80 hover:text-text-primary"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-primary-fixed-dim bg-primary-container/25 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          {camp.status || "rascunho"}
                        </span>
                        <span className="text-[10px] text-text-secondary font-mono">{camp.createdDate || "2026-08-26"}</span>
                      </div>
                      <h3 className="text-xs font-bold text-text-primary mt-2 line-clamp-1">
                        {camp.title}
                      </h3>
                      <p className="text-[11px] text-text-secondary mt-1 line-clamp-1">{camp.objective}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Selected Campaign Details (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {selectedCampaign ? (
              <div className="bg-surface-card rounded-xl border border-outline-border p-6 shadow-sm space-y-5">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-outline-border/60">
                  <div>
                    <h2 className="text-base font-black text-text-primary">{selectedCampaign.title}</h2>
                    <p className="text-xs text-text-secondary mt-1">{selectedCampaign.strategy}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onSaveCampaignToObsidian(selectedCampaign)}
                      className="px-3.5 py-2 bg-primary-container hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-white" />
                      <span>Salvar no Obsidian</span>
                    </button>
                  </div>
                </div>

                {apiConfig.connectionStatus !== "connected" && (
                  <div className="p-3 bg-primary-container/10 border border-primary-container/20 rounded-xl text-xs text-text-secondary">
                    <span>Para sincronizar automaticamente esta campanha com seu Obsidian, configure a conexão no menu superior.</span>
                  </div>
                )}

                <div className="space-y-4">
                  {selectedCampaign.channelsContent.map((item, idx) => (
                    <div key={idx} className="p-4 bg-surface-container-low rounded-xl border border-outline-border space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1c2028] text-primary-fixed-dim border border-outline-border">
                          {item.channel}
                        </span>
                        <button
                          onClick={() => handleCopyText(item.copy, `saved-${idx}`)}
                          className="text-xs font-bold text-text-secondary hover:text-text-primary flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5 text-primary-fixed-dim" />
                          <span>{copiedId === `saved-${idx}` ? "Copiado!" : "Copiar"}</span>
                        </button>
                      </div>
                      <h4 className="text-xs font-black text-text-primary">{item.title}</h4>
                      <pre className="whitespace-pre-wrap font-sans text-xs text-text-primary bg-surface-card p-4 rounded-xl border border-outline-border leading-relaxed shadow-inner">
                        {item.copy}
                      </pre>
                    </div>
                  ))}
                </div>

              </div>
            ) : (
              <div className="bg-surface-card rounded-xl border border-outline-border p-12 text-center text-text-secondary text-xs">
                Selecione uma campanha para visualizar os detalhes.
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
