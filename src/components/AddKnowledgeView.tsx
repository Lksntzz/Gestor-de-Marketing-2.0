import React, { useState, useEffect } from "react";
import {
  Cpu,
  FileText,
  Image as ImageIcon,
  Youtube,
  Globe,
  AlignLeft,
  UploadCloud,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  ExternalLink,
  FolderOpen,
  Link2,
  Tag,
  AlertCircle,
  Loader2,
  RotateCcw,
  Check,
  Edit3,
  ShieldCheck,
  FileCode,
  Inbox,
  Eye,
  Cloud,
  Trash2,
  RefreshCw,
  Download,
  Plus,
  X,
  Hourglass,
  Search,
  FileUp,
  Layers,
} from "lucide-react";
import { ObsidianNote, ObsidianApiConfig, KnowledgeStatus, EngineMode } from "../types";
import { STANDARD_VAULT_FOLDERS } from "../data/defaultVault";
import { buildObsidianOpenUri } from "../utils/obsidianUri";
import { GoogleDriveSelector } from "./GoogleDriveSelector";
import { googleDriveService } from "../services/googleDriveService";
import confetti from "canvas-confetti";

interface AddKnowledgeViewProps {
  notes: ObsidianNote[];
  onAddNote: (newNote: ObsidianNote) => void;
  apiConfig: ObsidianApiConfig;
  onNavigateTab: (tab: "dashboard" | "vault" | "campaigns" | "tasks" | "automations" | "routine") => void;
  onSelectNote: (note: ObsidianNote) => void;
  engineMode: EngineMode;
}

type KnowledgeType = "pdf" | "image" | "youtube" | "site" | "text" | "gdrive";

interface ProgressStep {
  percentage: number;
  message: string;
}

interface CurationProposal {
  title: string;
  folder: string;
  status: KnowledgeStatus;
  tipo: string;
  category: string;
  keywords: string[];
  wikilinks: string[];
  content: string;
  evidence: string[];
  marketingHypotheses: string[];
  sourceUrl?: string;
  fileName?: string;
}

export const AddKnowledgeView: React.FC<AddKnowledgeViewProps> = ({
  notes,
  onAddNote,
  apiConfig,
  onNavigateTab,
  onSelectNote,
  engineMode
}) => {
  const [selectedType, setSelectedType] = useState<KnowledgeType | null>("site");
  
  // Google Drive Connection Status
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(googleDriveService.isAuthenticated());

  useEffect(() => {
    // Initial check
    setIsDriveConnected(googleDriveService.isAuthenticated());

    // Periodically re-check (every 1.5s) to stay in sync with Settings Modal edits
    const interval = setInterval(() => {
      setIsDriveConnected(googleDriveService.isAuthenticated());
    }, 1500);

    return () => clearInterval(interval);
  }, []);
  
  // Form values
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>("");
  const [pdfTextSample, setPdfTextSample] = useState<string>("");
  const [pdfBase64, setPdfBase64] = useState<string>("");
  
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageTitle, setImageTitle] = useState<string>("");
  const [imageDescription, setImageDescription] = useState<string>("");
  const [imageCategory, setImageCategory] = useState<string>("07_Pesquisas");
  const [imageKeywords, setImageKeywords] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string>("");

  const [youtubeUrl, setYoutubeUrl] = useState<string>("");
  const [youtubeTitle, setYoutubeTitle] = useState<string>("");
  const [youtubeChannel, setYoutubeChannel] = useState<string>("");

  const [siteUrl, setSiteUrl] = useState<string>("https://marketing-strategy.com/q3-report");
  const [siteTitle, setSiteTitle] = useState<string>("Relatório Estratégico Q3 - Tendências de Mercado");

  const [rawText, setRawText] = useState<string>("");
  const [rawTextTitle, setRawTextTitle] = useState<string>("");

  // Processing & Curation pipeline states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Human-in-the-loop curation proposal
  const [curationProposal, setCurationProposal] = useState<CurationProposal | null>({
    title: "Relatório Estratégico Q3 - Tendências de Mercado",
    folder: "01_Inputs/Relatorios",
    status: "EM REVISÃO",
    tipo: "Artigo Web",
    category: "Marketing & Produtos",
    keywords: ["estrategia", "q3_2023", "tendencias"],
    wikilinks: ["Campanha de Retenção Q3", "Análise de Concorrentes 2023"],
    content: `## Executive Summary
O relatório destaca uma mudança significativa no comportamento do consumidor para o Q3, com aumento de 24% na demanda por soluções integradas. A principal hipótese de marketing sugere que focar em 'tempo de valorização' (TTW) reduzirá o churn em contas Enterprise.

## Evidências Extraídas
- Crescimento expressivo da demanda por produtos premium de papelaria no B2B.
- Preferência por prazos flexíveis e tiragens moderadas.

## Conexões de Rede
- Relacionado a [[Campanha de Retenção Q3]]
- Baseado em [[Análise de Concorrentes 2023]]`,
    evidence: [
      "Conteúdo estruturado com base nas diretrizes da Nisti Print.",
      "Metadados YAML compatíveis com o padrão do cofre Obsidian.",
      "Backlinks sugeridos para cruzar com personas e produtos."
    ],
    marketingHypotheses: [
      "Pode ser transformado em post para Instagram (Carrossel ASMR ou prova de produto).",
      "Pode servir de base para campanhas sazonais de Planners e Devocionais.",
      "Fortalece o posicionamento de tiragens sob demanda a partir de 10 unidades."
    ],
    sourceUrl: "https://marketing-strategy.com/q3-report"
  });
  const [curationViewMode, setCurationViewMode] = useState<"preview" | "edit">("preview");

  // Success summary report states
  const [createdNote, setCreatedNote] = useState<ObsidianNote | null>(null);
  const [relations, setRelations] = useState<string[]>([]);
  const [wasFallback, setWasFallback] = useState<boolean>(false);

  // Example inputs tailored for Nisti Print Marketing
  const useExampleInput = (type: KnowledgeType) => {
    setError(null);
    if (type === "pdf") {
      setPdfFileName("Briefing_Tecnico_Planners_e_Devocionais_2026.pdf");
      setPdfTextSample(`BRIEFING INDUSTRIAL & MARKETING NISTI PRINT 2026:
PRODUTO: Linha Planners Autoriais e Devocionais Diários
ACABAMENTO: Capa dura 2.0mm Soft Touch fosca, miolo offset 90g (sem vazamento de tinta), wire-o bronze 1 polegada.
PROPOSTA DE VALOR: Tiragens sob demanda a partir de 10 unidades com preço de atacado para empreendedoras de papelaria e ministérios.
PÚBLICO-ALVO: Mariana (Empreendedora Criativa) e Líderes Eclesiásticos.
DIFERENCIAIS: Fidelidade de cor CMYK, elástico acetinado com passante metálico, bolsa interna dupla.`);
    } else if (type === "image") {
      setImageTitle("Foto de Prova - Planner Soft Touch e Wire-o Bronze");
      setImageDescription("Ativo visual exibindo acabamento premium da capa com laminação Soft Touch e encadernação wire-o bronze da Nisti Print.");
      setImageCategory("02_Produtos");
      setImageKeywords("planner-2026, acabamento-luxo, wire-o, nisti-print");
      setImageBase64("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
    } else if (type === "youtube") {
      setYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      setYoutubeTitle("Como Criar e Vender Planners Personalizados Sem Estoque Parado");
      setYoutubeChannel("Papelaria Criativa & Negócios");
    } else if (type === "site") {
      setSiteUrl("https://nistiprint.com.br/blog/como-escolher-a-gramatura-certa-de-papel");
      setSiteTitle("Guia de Papéis: Por que o Offset 90g é o queridinho para Planners e Devocionais");
    } else if (type === "text") {
      setRawTextTitle("Ideias de Ganchos para Carrossel de Planners no Instagram");
      setRawText(`Ideias de copy para Nisti Print:
1. "Você já desenhou o planner dos seus sonhos, mas a gráfica pediu 500 unidades mínimas?"
2. "O teste definitivo: caneta marca-texto em papel 75g vs miolo Offset 90g da Nisti Print."
3. "Como lucrar até 150% na temporada de fim de ano vendendo agendas e planners autorais sem risco financeiro."
Vincular com [[Brand Voice & Posicionamento Nisti Print]] e [[Catálogo - Planners & Devocionais 2026]].`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPdfFile(file);
      setPdfFileName(file.name);
      setPdfTextSample(`[Arquivo PDF '${file.name}' carregado - tamanho: ${Math.round(file.size / 1024)} KB]`);

      const reader = new FileReader();
      reader.onloadend = () => {
        setPdfBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      
      if (!imageTitle) {
        const titleWithoutExtension = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        const words = titleWithoutExtension.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        setImageTitle(words);
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGoogleDriveFileSelected = (fileData: {
    name: string;
    contentText: string;
    base64?: string;
    isPdf?: boolean;
    mimeType: string;
  }) => {
    if (fileData.isPdf || fileData.name.toLowerCase().endsWith(".pdf")) {
      setSelectedType("pdf");
      setPdfFileName(fileData.name);
      setPdfTextSample(fileData.contentText || `[Arquivo PDF do Google Drive: ${fileData.name}]`);
      if (fileData.base64) {
        setPdfBase64(fileData.base64);
      }
    } else if (fileData.mimeType.startsWith("image/")) {
      setSelectedType("image");
      setImageTitle(fileData.name.replace(/\.[^/.]+$/, ""));
      setImageDescription(`Ativo importado do Google Drive: ${fileData.name}`);
      if (fileData.base64) {
        setImageBase64(fileData.base64);
      }
    } else {
      setSelectedType("text");
      setRawTextTitle(fileData.name.replace(/\.[^/.]+$/, ""));
      setRawText(fileData.contentText);
    }
  };

  const handleStartProcessing = async () => {
    setError(null);
    setCreatedNote(null);
    setCurationProposal(null);
    setRelations([]);

    // Validation
    if (selectedType === "pdf" && !pdfFileName) {
      setError("Por favor, faça o upload de um arquivo PDF ou clique em 'Usar Exemplo'.");
      return;
    }
    if (selectedType === "image" && !imageTitle && !imageBase64) {
      setError("Por favor, dê um título à nota ou faça o upload de uma imagem.");
      return;
    }
    if (selectedType === "youtube" && !youtubeUrl) {
      setError("O link do vídeo do YouTube é obrigatório.");
      return;
    }
    if (selectedType === "site" && !siteUrl) {
      setError("A URL do site é obrigatória.");
      return;
    }
    if (selectedType === "text" && (!rawText || !rawTextTitle)) {
      setError("Título e corpo do texto são obrigatórios.");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setProgressMessage("Carregando conteúdo bruto...");

    const steps: ProgressStep[] = [
      { percentage: 15, message: "Lendo e limpando formatação do conteúdo..." },
      { percentage: 35, message: "Extraindo evidências técnicas e conceitos de marketing..." },
      { percentage: 55, message: "Classificando taxonomia nas pastas do Obsidian..." },
      { percentage: 75, message: "Mapeando backlinks atômicos com notas existentes..." },
      { percentage: 90, message: "Gerando proposta de curadoria com Frontmatter estruturado..." },
      { percentage: 100, message: "Pronto para revisão humana!" }
    ];

    let payload: any = {};
    if (selectedType === "pdf") {
      payload = { fileName: pdfFileName, textContentSample: pdfTextSample, base64: pdfBase64 };
    } else if (selectedType === "image") {
      payload = { 
        title: imageTitle, 
        description: imageDescription, 
        category: imageCategory, 
        keywords: imageKeywords.split(",").map(k => k.trim()).filter(Boolean),
        imageBase64: imageBase64 || undefined
      };
    } else if (selectedType === "youtube") {
      payload = { url: youtubeUrl, videoTitle: youtubeTitle, videoChannel: youtubeChannel };
    } else if (selectedType === "site") {
      payload = { url: siteUrl, pageTitle: siteTitle };
    } else if (selectedType === "text") {
      payload = { text: rawText, title: rawTextTitle };
    }

    let currentStepIdx = 0;
    const progressInterval = setInterval(() => {
      if (currentStepIdx < steps.length - 2) {
        currentStepIdx++;
        setProgress(steps[currentStepIdx].percentage);
        setProgressMessage(steps[currentStepIdx].message);
      }
    }, 1000);

    try {
      const response = await fetch("/api/gemini/process-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selectedType, payload, engineMode })
      });

      if (!response.ok) {
        throw new Error(`Erro no servidor: Código ${response.status}`);
      }

      const resData = await response.json();
      
      clearInterval(progressInterval);
      setProgress(100);
      setProgressMessage("Curadoria pronta para validação!");
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (resData.success && resData.data) {
        const aiData = resData.data;

        // Map folder to standard folders
        let targetFolder = aiData.folder || "00_Inbox";
        if (!STANDARD_VAULT_FOLDERS.includes(targetFolder)) {
          targetFolder = "00_Inbox";
        }

        // Build proposal for Human-in-the-Loop review
        const proposal: CurationProposal = {
          title: aiData.title || (payload.title || "Novo Conhecimento"),
          folder: targetFolder,
          status: targetFolder === "00_Inbox" ? "NOVO" : "EM REVISÃO",
          tipo: selectedType === "pdf" ? "Documento PDF" : selectedType === "image" ? "Ativo Visual" : selectedType === "youtube" ? "Vídeo Referência" : selectedType === "site" ? "Artigo Web" : "Rascunho de Conteúdo",
          category: aiData.category || "Marketing & Produtos",
          keywords: aiData.keywords || aiData.tags || ["nisti-print", "marketing"],
          wikilinks: aiData.wikilinks || ["Brand Voice & Posicionamento Nisti Print", "Catálogo - Planners & Devocionais 2026"],
          content: aiData.content || "",
          evidence: [
            "Conteúdo estruturado com base nas diretrizes da Nisti Print.",
            "Metadados YAML compatíveis com o padrão do cofre Obsidian.",
            "Backlinks sugeridos para cruzar com personas e produtos."
          ],
          marketingHypotheses: [
            "Pode ser transformado em post para Instagram (Carrossel ASMR ou prova de produto).",
            "Pode servir de base para campanhas sazonais de Planners e Devocionais.",
            "Fortalece o posicionamento de tiragens sob demanda a partir de 10 unidades."
          ],
          sourceUrl: payload.url || undefined,
          fileName: payload.fileName || undefined
        };

        // Auto-save the note instead of asking for manual curation
        await handleConfirmAndSave(proposal, false);
      } else {
        throw new Error("Resposta inválida da API do servidor");
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      setError(`Ocorreu um erro ao processar o conhecimento: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm and persist note into Obsidian Vault
  const handleConfirmAndSave = async (proposalToSave: CurationProposal | null = curationProposal, forceInbox: boolean = false) => {
    if (!proposalToSave) return;

    const folderToUse = forceInbox ? "00_Inbox" : proposalToSave.folder;
    const statusToUse = forceInbox ? "NOVO" : proposalToSave.status;
    const todayStr = new Date().toISOString().replace("T", " ").substring(0, 16);
    const noteId = `note-${Date.now().toString(36)}`;
    const hash = `np_${Math.random().toString(36).substring(2, 8)}`;
    const notePath = `${folderToUse}/${proposalToSave.title}.md`;

    // Ensure content has structured frontmatter
    const frontmatterBlock = `---
id: ${noteId}
tipo: ${proposalToSave.tipo}
status: ${statusToUse}
owner: Gestor de Marketing Nisti Print
created_at: ${todayStr}
updated_at: ${todayStr}
validade: 2027-12-31
confidencialidade: Interno
produto: Linha Planners & Personalizados
nicho: Papelaria Criativa & B2B
canal: Omnichannel
projeto: Gestão de Conhecimento
tags:
${proposalToSave.keywords.map(k => `  - ${k}`).join("\n")}
origem: ${proposalToSave.fileName || proposalToSave.sourceUrl || "Central de Conhecimento Nisti"}
approved_by: ${statusToUse === "OFICIAL" ? "Gestor de Marketing" : ""}
hash: ${hash}
---

`;

    let finalContent = proposalToSave.content;
    if (!finalContent.startsWith("---")) {
      finalContent = frontmatterBlock + finalContent;
    }

    const newNote: ObsidianNote = {
      id: noteId,
      path: notePath,
      title: proposalToSave.title,
      folder: folderToUse,
      content: finalContent,
      tags: proposalToSave.keywords,
      wikilinks: proposalToSave.wikilinks,
      frontmatter: {
        id: noteId,
        tipo: proposalToSave.tipo,
        status: statusToUse,
        owner: "Gestor de Marketing Nisti Print",
        created_at: todayStr,
        updated_at: todayStr,
        validade: "2027-12-31",
        confidencialidade: "Interno",
        produto: "Linha Planners & Personalizados",
        nicho: "Papelaria Criativa & B2B",
        canal: "Omnichannel",
        projeto: "Gestão de Conhecimento",
        tags: proposalToSave.keywords,
        origem: proposalToSave.fileName || proposalToSave.sourceUrl || "Central de Conhecimento Nisti",
        approved_by: statusToUse === "OFICIAL" ? "Gestor de Marketing" : "",
        hash: hash,
      },
      lastModified: todayStr,
      syncedWithApi: apiConfig.connectionStatus === "connected",
    };

    // Save to global state & local vault
    onAddNote(newNote);

    // Save directly to disk if running in Electron
    if (window.electronAPI) {
      try {
        const vaultPath = await window.electronAPI.getVaultPath();
        if (vaultPath) {
          await window.electronAPI.writeNote(
            vaultPath,
            folderToUse,
            proposalToSave.title,
            finalContent,
            newNote.frontmatter
          );
        }
      } catch (err) {
        console.warn("Electron write error:", err);
      }
    }

    confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
    setCreatedNote(newNote);
    setRelations(proposalToSave.wikilinks);
    setCurationProposal(null);
  };

  const resetForm = () => {
    setSelectedType(null);
    setPdfFile(null);
    setPdfFileName("");
    setPdfTextSample("");
    setImageUrl("");
    setImageTitle("");
    setImageDescription("");
    setImageKeywords("");
    setImageFile(null);
    setImageBase64("");
    setYoutubeUrl("");
    setYoutubeTitle("");
    setYoutubeChannel("");
    setSiteUrl("");
    setSiteTitle("");
    setRawText("");
    setRawTextTitle("");
    setError(null);
    setCurationProposal(null);
    setCreatedNote(null);
    setRelations([]);
  };

  const handleOpenNoteInVault = () => {
    if (createdNote) {
      onSelectNote(createdNote);
      onNavigateTab("vault");
    }
  };

  return (
    <div className="w-full h-full flex flex-col gap-4 animate-fadeIn font-sans min-h-0">
      
      {/* 1. CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 shrink-0 border-b border-[#334155]/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold text-pink-500 uppercase tracking-widest bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20 font-sans">
              Pipeline de Ingestão PKM
            </span>
            <span className="text-xs text-text-secondary font-medium">
              Curadoria & Validação Humana
            </span>
          </div>
          <h1 className="text-2xl font-black text-text-primary tracking-tight mt-1">
            Adicionar Conhecimento
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Ingestão e processamento de novas fontes para o cofre Obsidian.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-text-primary bg-[#182234] px-3 py-1.5 rounded-xl border border-[#334155]">
            📂 {notes.length} Notas no Cofre
          </span>
          <span className="text-xs font-bold text-[#b4c5ff] bg-primary-container/10 px-2.5 py-1.5 rounded-xl border border-primary-container/20 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-pink-500" />
            <span>Curador Inteligente</span>
          </span>
        </div>
      </div>

      {/* 2. ERROR STATE */}
      {error && (
        <div className="p-4 bg-red-500/10 text-red-200 border border-red-500/20 rounded-xl flex items-start gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold text-red-300">Aviso no Processamento:</span>
            <p className="leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* 3. TWO COLUMN INTEGRATED GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        
        {/* LEFT COLUMN: Input Source & Pipeline Tracker */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4 min-h-0 overflow-y-auto no-scrollbar">
          
          {/* Card: Fonte de Entrada */}
          <div className="bg-surface-card border border-outline-border rounded-xl p-5 flex flex-col shrink-0">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#F8FAFC] mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4 text-sky-400 shrink-0" />
              <span>Fonte de Entrada</span>
            </h3>

            {/* Selection Options Grid */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <button
                type="button"
                onClick={() => { setSelectedType("site"); setError(null); }}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                  selectedType === "site"
                    ? "bg-[#1E293B] border-[#2563eb] text-[#b4c5ff]"
                    : "bg-[#111827] border-[#334155] text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F8FAFC]"
                }`}
              >
                <Link2 className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider">URL Web</span>
              </button>
              <button
                type="button"
                onClick={() => { setSelectedType("pdf"); setError(null); }}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                  selectedType === "pdf"
                    ? "bg-[#1E293B] border-[#2563eb] text-[#b4c5ff]"
                    : "bg-[#111827] border-[#334155] text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F8FAFC]"
                }`}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider">PDF Document</span>
              </button>
              <button
                type="button"
                onClick={() => { setSelectedType("youtube"); setError(null); }}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                  selectedType === "youtube"
                    ? "bg-[#1E293B] border-[#2563eb] text-[#b4c5ff]"
                    : "bg-[#111827] border-[#334155] text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F8FAFC]"
                }`}
              >
                <Youtube className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider">YouTube</span>
              </button>
              <button
                type="button"
                onClick={() => { setSelectedType("image"); setError(null); }}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                  selectedType === "image"
                    ? "bg-[#1E293B] border-[#2563eb] text-[#b4c5ff]"
                    : "bg-[#111827] border-[#334155] text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F8FAFC]"
                }`}
              >
                <ImageIcon className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider font-sans">Imagem / OCR</span>
              </button>
              <button
                type="button"
                onClick={() => { setSelectedType("text"); setError(null); }}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                  selectedType === "text"
                    ? "bg-[#1E293B] border-[#2563eb] text-[#b4c5ff]"
                    : "bg-[#111827] border-[#334155] text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F8FAFC]"
                }`}
              >
                <AlignLeft className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Texto Livre</span>
              </button>
              <button
                type="button"
                onClick={() => { setSelectedType("gdrive"); setError(null); }}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                  selectedType === "gdrive"
                    ? "bg-[#1E293B] border-[#2563eb] text-[#b4c5ff]"
                    : "bg-[#111827] border-[#334155] text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F8FAFC]"
                }`}
              >
                <Cloud className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Drive Sync</span>
              </button>
            </div>

            {/* Inputs based on type */}
            <div className="space-y-3">
              {selectedType === "site" && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    placeholder="Cole a URL ou arraste o arquivo..."
                    className="flex-1 bg-[#0f131c] border border-[#334155] rounded-xl px-3 py-2.5 font-sans text-xs text-[#F8FAFC] placeholder-[#94A3B8] focus:border-[#2563eb] outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => useExampleInput("site")}
                    className="bg-[#1E293B] border border-[#334155] px-3 py-2.5 rounded-xl text-[#F8FAFC] hover:bg-[#31353e] hover:border-[#8d90a0] transition-colors cursor-pointer flex items-center justify-center shrink-0"
                    title="Usar Exemplo Nisti"
                  >
                    <FileUp className="w-4 h-4 shrink-0" />
                  </button>
                </div>
              )}

              {selectedType === "pdf" && (
                <div className="space-y-3">
                  <div className="border border-dashed border-[#334155] hover:border-[#2563eb] rounded-xl p-4 text-center bg-[#111827] cursor-pointer relative transition-colors">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <UploadCloud className="w-6 h-6 text-sky-400 mx-auto mb-1.5" />
                    <span className="text-[11px] font-bold text-[#F8FAFC] block truncate">
                      {pdfFileName ? pdfFileName : "Clique para selecionar o PDF ou arraste para cá"}
                    </span>
                    <span className="text-[9px] text-[#94A3B8] block mt-0.5">
                      Suporta briefings técnicos, orçamentos e manuais
                    </span>
                  </div>
                  {pdfFileName && (
                    <div className="space-y-2">
                      <textarea
                        value={pdfTextSample}
                        onChange={(e) => setPdfTextSample(e.target.value)}
                        className="w-full h-20 p-2.5 bg-[#0f131c] border border-[#334155] rounded-xl font-mono text-[11px] text-[#F8FAFC] leading-relaxed outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => useExampleInput("pdf")}
                        className="w-full py-1.5 bg-[#1E293B] border border-[#334155] rounded-xl text-[11px] font-bold text-[#F8FAFC] hover:bg-[#31353e] transition-colors"
                      >
                        Usar Exemplo PDF Nisti
                      </button>
                    </div>
                  )}
                </div>
              )}

              {selectedType === "image" && (
                <div className="space-y-3">
                  {imageBase64 ? (
                    <div className="border border-[#334155] rounded-xl p-2.5 bg-[#111827] text-center space-y-2">
                      <img src={imageBase64} alt="Preview" className="max-h-28 mx-auto rounded object-contain" referrerPolicy="no-referrer" />
                      <button
                        type="button"
                        onClick={() => { setImageFile(null); setImageBase64(""); }}
                        className="text-[10px] text-red-400 hover:underline font-bold"
                      >
                        Remover Imagem
                      </button>
                    </div>
                  ) : (
                    <div className="border border-dashed border-[#334155] hover:border-[#2563eb] rounded-xl p-4 text-center bg-[#111827] cursor-pointer relative h-28 flex flex-col items-center justify-center transition-colors">
                      <input type="file" accept="image/*" onChange={handleImageFileChange} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                      <UploadCloud className="w-6 h-6 text-sky-400 mb-1" />
                      <span className="text-[10px] font-bold text-[#F8FAFC]">Selecione uma imagem de produto/capa</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Título do Ativo"
                      value={imageTitle}
                      onChange={(e) => setImageTitle(e.target.value)}
                      className="bg-[#0f131c] border border-[#334155] rounded-xl px-2.5 py-1.5 font-sans text-[11px] text-[#F8FAFC] placeholder-[#94A3B8] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => useExampleInput("image")}
                      className="bg-[#1E293B] border border-[#334155] rounded-xl text-[11px] text-[#F8FAFC] font-bold hover:bg-[#31353e] transition-colors"
                    >
                      Usar Exemplo
                    </button>
                  </div>
                </div>
              )}

              {selectedType === "youtube" && (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="URL do Vídeo (Ex: https://youtube.com/...)"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="w-full bg-[#0f131c] border border-[#334155] rounded-xl px-3 py-2 font-sans text-xs text-[#F8FAFC] placeholder-[#94A3B8] outline-none"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Título do Vídeo (Opcional)"
                      value={youtubeTitle}
                      onChange={(e) => setYoutubeTitle(e.target.value)}
                      className="flex-1 bg-[#0f131c] border border-[#334155] rounded-xl px-3 py-1.5 font-sans text-[11px] text-[#F8FAFC] placeholder-[#94A3B8] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => useExampleInput("youtube")}
                      className="bg-[#1E293B] border border-[#334155] px-3.5 rounded-xl text-[#F8FAFC] hover:bg-[#31353e] shrink-0"
                    >
                      Exemplo
                    </button>
                  </div>
                </div>
              )}

              {selectedType === "text" && (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Título da Nota / Ideia..."
                    value={rawTextTitle}
                    onChange={(e) => setRawTextTitle(e.target.value)}
                    className="w-full bg-[#0f131c] border border-[#334155] rounded-xl px-3 py-1.5 font-sans text-xs text-[#F8FAFC] placeholder-[#94A3B8] outline-none"
                  />
                  <textarea
                    placeholder="Cole ou digite aqui suas anotações..."
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    className="w-full h-24 bg-[#0f131c] border border-[#334155] rounded-xl p-2.5 font-sans text-xs text-[#F8FAFC] placeholder-[#94A3B8] outline-none resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => useExampleInput("text")}
                    className="w-full py-1.5 bg-[#1E293B] border border-[#334155] rounded-xl text-xs text-[#F8FAFC] font-semibold hover:bg-[#31353e]"
                  >
                    Usar Exemplo
                  </button>
                </div>
              )}

              {selectedType === "gdrive" && (
                <div className="space-y-2">
                  {isDriveConnected ? (
                    <GoogleDriveSelector
                      onSelectFile={handleGoogleDriveFileSelected}
                      onCancel={() => setSelectedType("site")}
                    />
                  ) : (
                    <div className="p-4 bg-red-500/10 text-red-200 border border-red-500/20 rounded-xl text-center text-xs space-y-1">
                      <p className="font-bold">Google Drive não Conectado</p>
                      <p className="text-[10px] text-text-secondary">Conecte sua conta do Google Drive no modal de Configurações para carregar seus relatórios.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Action Button */}
            <button
              onClick={handleStartProcessing}
              disabled={isProcessing}
              className="mt-6 w-full py-3.5 bg-primary-container text-[#F8FAFC] font-black uppercase tracking-widest text-xs rounded-xl shadow-lg border border-primary-container/20 hover:bg-primary-container/90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Cpu className="w-4 h-4" />
              <span>Processar Conhecimento</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Curation Proposal or Active States */}
        <div className="col-span-12 lg:col-span-7 flex flex-col min-h-0 overflow-y-auto no-scrollbar">
          
          {isProcessing ? (
            /* Loading State inside curation card area */
            <div className="bg-surface-card border border-outline-border rounded-xl p-8 space-y-8 flex flex-col justify-center flex-1 min-h-0">
              
              <div className="text-center space-y-2 mb-4">
                <div className="w-14 h-14 bg-primary-container/10 border border-primary-container/20 rounded-2xl flex items-center justify-center animate-pulse mx-auto mb-4">
                  <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
                </div>
                <span className="text-[10px] font-bold text-[#b4c5ff] uppercase tracking-widest block">
                  Curador do Obsidian Ativo
                </span>
                <h2 className="text-base font-black text-text-primary mt-1">
                  Pipeline de Processamento
                </h2>
              </div>
              
              {/* Vertical Steps Timeline Dynamic */}
              <div className="flex flex-col gap-0 max-w-md mx-auto w-full">
                
                {/* Step 1 */}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center mt-1 shrink-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${progress >= 15 ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-[#111827] border border-[#334155]'}`}>
                      {progress >= 35 ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${progress >= 15 ? 'text-emerald-400 animate-spin' : 'text-[#94A3B8]'}`} />}
                    </div>
                    <div className="w-px h-10 bg-gradient-to-b from-[#334155] to-transparent my-1"></div>
                  </div>
                  <div className="pb-8">
                    <h4 className={`font-bold text-sm ${progress >= 15 ? 'text-[#F8FAFC]' : 'text-[#94A3B8]'}`}>Extração de Conteúdo</h4>
                    <p className="text-xs text-[#94A3B8] mt-0.5">Leitura e limpeza da formatação.</p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${progress >= 35 ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-[#111827] border border-[#334155]'}`}>
                      {progress >= 55 ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${progress >= 35 ? 'text-emerald-400 animate-spin' : 'text-[#94A3B8]'}`} />}
                    </div>
                    <div className="w-px h-10 bg-gradient-to-b from-[#334155] to-transparent my-1"></div>
                  </div>
                  <div className="pb-8">
                    <h4 className={`font-bold text-sm ${progress >= 35 ? 'text-[#F8FAFC]' : 'text-[#94A3B8]'}`}>Análise Semântica (LLM)</h4>
                    <p className="text-xs text-[#94A3B8] mt-0.5">Extração de evidências e taxonomia.</p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${progress >= 75 ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-[#111827] border border-[#334155]'}`}>
                      {progress >= 90 ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${progress >= 75 ? 'text-emerald-400 animate-spin' : 'text-[#94A3B8]'}`} />}
                    </div>
                    <div className="w-px h-10 bg-gradient-to-b from-[#334155] to-transparent my-1"></div>
                  </div>
                  <div className="pb-8">
                    <h4 className={`font-bold text-sm ${progress >= 75 ? 'text-[#F8FAFC]' : 'text-[#94A3B8]'}`}>Mapeamento de Conexões</h4>
                    <p className="text-xs text-[#94A3B8] mt-0.5">Cruzando tags e notas do Vault.</p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${progress >= 90 ? 'bg-blue-500/20 border border-blue-500/40' : 'bg-[#111827] border border-[#334155]'}`}>
                      {progress >= 100 ? <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <Hourglass className={`w-3.5 h-3.5 shrink-0 ${progress >= 90 ? 'text-blue-400 animate-pulse' : 'text-[#94A3B8]'}`} />}
                    </div>
                  </div>
                  <div className="pb-0">
                    <h4 className={`font-bold text-sm ${progress >= 90 ? 'text-blue-400' : 'text-[#94A3B8]'}`}>{apiConfig.connectionStatus === "connected" ? "Gravação no Cofre" : "Salvar no Painel"}</h4>
                    <p className="text-xs text-[#94A3B8] mt-0.5">{apiConfig.connectionStatus === "connected" ? "Salvando arquivo Markdown estruturado." : "Salvo localmente (sem API)."}</p>
                  </div>
                </div>
              </div>

            </div>
          ) : createdNote ? (
            /* Success Saved State Inside Right column */
            <div className="bg-surface-card border border-outline-border rounded-xl p-6 space-y-6 flex flex-col justify-center flex-1 min-h-0 animate-fadeIn">
              <div className="flex items-start gap-4 pb-4 border-b border-[#334155]/60">
                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-2xl flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                    {apiConfig.connectionStatus === "connected" ? "Nota Gravada com Sucesso no Cofre!" : "Nota Adicionada Apenas ao Painel Local!"}
                  </span>
                  <h2 className="text-lg font-black text-text-primary mt-0.5">
                    {createdNote.title}
                  </h2>
                  <p className="text-xs text-text-secondary font-mono mt-1">
                    📁 {createdNote.path}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-[#0f131c] rounded-xl border border-[#334155] space-y-2.5 text-xs">
                <span className="font-bold text-text-primary block">Conexões Atômicas Realizadas (Backlinks):</span>
                <div className="flex flex-wrap gap-2">
                  {relations.map((rel, i) => (
                    <span key={i} className="px-2.5 py-1 bg-primary-container/10 text-primary-fixed-dim rounded-lg border border-primary-container/20 font-mono text-[11px] font-bold flex items-center gap-1">
                      <Link2 className="w-3 h-3 text-pink-500" />
                      <span>[[{rel}]]</span>
                    </span>
                  ))}
                  {relations.length === 0 && (
                    <span className="text-text-secondary italic text-xs">Nenhum backlink gerado.</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#334155]/60 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-[#1E293B] hover:bg-[#31353e] text-[#F8FAFC] text-xs font-bold rounded-xl border border-[#334155] cursor-pointer transition-colors"
                >
                  + Adicionar Outro
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenNoteInVault}
                    className="px-4 py-2 bg-primary-container/10 border border-primary-container/25 text-primary hover:bg-primary-container/20 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                  >
                    Ver no Navegador
                  </button>
                  <a
                    href={buildObsidianOpenUri(apiConfig.vaultName, createdNote.path)}
                    className="px-4 py-2 bg-[#2563eb] hover:bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <span>Abrir no Obsidian</span>
                    <ExternalLink className="w-3.5 h-3.5 text-white" />
                  </a>
                </div>
              </div>
            </div>
          ) : (
            /* Empty Placeholder Curation State */
            <div className="bg-surface-card border border-outline-border rounded-xl p-8 flex flex-col items-center justify-center flex-1 text-center min-h-0">
              <Globe className="w-12 h-12 text-[#334155] mb-4" />
              <h3 className="text-sm font-bold text-[#F8FAFC]">Aguardando Processamento</h3>
              <p className="text-xs text-[#94A3B8] max-w-sm mt-1 leading-relaxed">
                Insira uma fonte de entrada à esquerda e clique em processar para gerar a proposta de curadoria automática.
              </p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
