import React, { useState, useEffect } from "react";
import {
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
  Cloud
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
  const [selectedType, setSelectedType] = useState<KnowledgeType | null>(null);
  
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

  const [siteUrl, setSiteUrl] = useState<string>("");
  const [siteTitle, setSiteTitle] = useState<string>("");

  const [rawText, setRawText] = useState<string>("");
  const [rawTextTitle, setRawTextTitle] = useState<string>("");

  // Processing & Curation pipeline states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Human-in-the-loop curation proposal
  const [curationProposal, setCurationProposal] = useState<CurationProposal | null>(null);
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
    }, 400);

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

        setCurationProposal(proposal);
        setWasFallback(!!resData.wasFallback);
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
  const handleConfirmAndSave = async (forceInbox: boolean = false) => {
    if (!curationProposal) return;

    const folderToUse = forceInbox ? "00_Inbox" : curationProposal.folder;
    const statusToUse = forceInbox ? "NOVO" : curationProposal.status;
    const todayStr = new Date().toISOString().replace("T", " ").substring(0, 16);
    const noteId = `note-${Date.now().toString(36)}`;
    const hash = `np_${Math.random().toString(36).substring(2, 8)}`;
    const notePath = `${folderToUse}/${curationProposal.title}.md`;

    // Ensure content has structured frontmatter
    const frontmatterBlock = `---
id: ${noteId}
tipo: ${curationProposal.tipo}
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
${curationProposal.keywords.map(k => `  - ${k}`).join("\n")}
origem: ${curationProposal.fileName || curationProposal.sourceUrl || "Central de Conhecimento Nisti"}
approved_by: ${statusToUse === "OFICIAL" ? "Gestor de Marketing" : ""}
hash: ${hash}
---

`;

    let finalContent = curationProposal.content;
    if (!finalContent.startsWith("---")) {
      finalContent = frontmatterBlock + finalContent;
    }

    const newNote: ObsidianNote = {
      id: noteId,
      path: notePath,
      title: curationProposal.title,
      folder: folderToUse,
      content: finalContent,
      tags: curationProposal.keywords,
      wikilinks: curationProposal.wikilinks,
      frontmatter: {
        id: noteId,
        tipo: curationProposal.tipo,
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
        tags: curationProposal.keywords,
        origem: curationProposal.fileName || curationProposal.sourceUrl || "Central de Conhecimento Nisti",
        approved_by: statusToUse === "OFICIAL" ? "Gestor de Marketing" : "",
        hash: hash,
      },
      lastModified: todayStr,
      syncedWithApi: true,
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
            curationProposal.title,
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
    setRelations(curationProposal.wikilinks);
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

  const knowledgeOptions = [
    {
      id: "pdf" as const,
      label: "Arquivo PDF / Briefing",
      icon: FileText,
      color: "bg-red-50 text-red-700 border-red-200 hover:border-red-400",
      description: "Briefings técnicos de produtos, tabelas de preços ou manuais de acabamento."
    },
    {
      id: "image" as const,
      label: "Ativo de Imagem / Mockup",
      icon: ImageIcon,
      color: "bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-400",
      description: "Fotos de capas, mockups de planners, fotos de galpão e amostras físicas."
    },
    {
      id: "youtube" as const,
      label: "Vídeo do YouTube",
      icon: Youtube,
      color: "bg-rose-50 text-rose-700 border-rose-200 hover:border-rose-400",
      description: "Vídeos tutoriais de papelaria, reviews de produtos e tendências de mercado."
    },
    {
      id: "site" as const,
      label: "Página Web / Artigo",
      icon: Globe,
      color: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:border-indigo-400",
      description: "Artigos de concorrentes, posts de blog ou notícias sobre o mercado gráfico."
    },
    {
      id: "text" as const,
      label: "Texto / Rascunho Livre",
      icon: AlignLeft,
      color: "bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400",
      description: "Ideias de campanhas, atas de reuniões rápidas e insights de novos produtos."
    },
    ...(isDriveConnected
      ? [
          {
            id: "gdrive" as const,
            label: "Google Drive / Nuvem",
            icon: Cloud,
            color: "bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-400",
            description: "Navegue e importe briefings, docs, planilhas e relatórios da sua conta Google."
          }
        ]
      : [])
  ];

  return (
    <div className="w-full px-4 md:px-8 lg:px-12 space-y-8 pb-20 animate-fadeIn">
      
      {/* 1. CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-widest bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
              Pipeline de Ingestão PKM
            </span>
            <span className="text-xs text-stone-400 font-medium">
              Curadoria & Validação Humana
            </span>
          </div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight mt-1">
            Central de Conhecimento Nisti Print
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Capture dados brutos. O sistema extrai evidências, propõe classificação e solicita confirmação antes de gravar no Obsidian.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-stone-600 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200/70">
            📂 {notes.length} Notas no Cofre
          </span>
          <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1.5 rounded-xl border border-purple-200 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Curador Inteligente</span>
          </span>
        </div>
      </div>

      {/* 2. ERROR STATE */}
      {error && (
        <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-2xl flex items-start gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold">Aviso no Processamento:</span>
            <p className="leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* 3. CAPTURE FORM / SELECTION (WHEN NOT IN REVIEW OR RESULT) */}
      {!curationProposal && !createdNote && !isProcessing && (
        <div className="space-y-6">
          
          {/* Card Selection Grid */}
          {!selectedType ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {knowledgeOptions.map((opt) => {
                  const IconComponent = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedType(opt.id)}
                      className="p-5 bg-white hover:bg-stone-50/80 rounded-2xl border border-stone-200/80 hover:border-purple-300 shadow-3xs hover:shadow-xs transition-all text-left space-y-3 cursor-pointer group"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${opt.color}`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-stone-900 group-hover:text-purple-900 transition-colors">
                          {opt.label}
                        </h3>
                        <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                          {opt.description}
                        </p>
                      </div>
                      <div className="pt-2 flex items-center gap-1 text-[11px] font-bold text-purple-700">
                        <span>Selecionar</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {isDriveConnected && (
                <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-xs space-y-4 animate-fadeIn">
                  <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold border border-blue-100">
                      <FolderOpen className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-stone-900">
                        📂 PASTA DO GOOGLE DRIVE (CONECTADO)
                      </h3>
                      <p className="text-[10px] text-stone-500 mt-0.5">
                        Sua conta Google está conectada. Selecione qualquer arquivo listado abaixo para importação direta e curadoria automática.
                      </p>
                    </div>
                  </div>
                  <GoogleDriveSelector
                    onSelectFile={handleGoogleDriveFileSelected}
                    onCancel={() => {}}
                  />
                </div>
              )}
            </div>
          ) : (
            /* Selected Capture Type Form */
            <div className="bg-white rounded-3xl border border-stone-200/80 p-6 sm:p-8 shadow-xs space-y-6 animate-fadeIn">
              
              <div className="flex items-center justify-between pb-4 border-b border-stone-150">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-50 text-purple-700 rounded-xl border border-purple-150">
                    {selectedType === "pdf" && <FileText className="w-5 h-5" />}
                    {selectedType === "image" && <ImageIcon className="w-5 h-5" />}
                    {selectedType === "youtube" && <Youtube className="w-5 h-5" />}
                    {selectedType === "site" && <Globe className="w-5 h-5" />}
                    {selectedType === "text" && <AlignLeft className="w-5 h-5" />}
                    {selectedType === "gdrive" && <Cloud className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-base font-black text-stone-900">
                      {knowledgeOptions.find((o) => o.id === selectedType)?.label}
                    </h2>
                    <p className="text-xs text-stone-500">
                      {selectedType === "gdrive"
                        ? "Selecione o arquivo da sua nuvem para importação e curadoria automática."
                        : "Insira os dados brutos ou clique em 'Usar Exemplo Nisti' para testar."}
                    </p>
                  </div>
                </div>

                {selectedType !== "gdrive" && (
                  <button
                    onClick={() => useExampleInput(selectedType)}
                    className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl border border-stone-200 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Usar Exemplo Nisti Print</span>
                  </button>
                )}
              </div>

              {/* PDF FLOW */}
              {selectedType === "pdf" && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-stone-300 hover:border-purple-400 rounded-2xl p-6 text-center bg-stone-50/50 cursor-pointer relative">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <UploadCloud className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    <span className="text-xs font-bold text-stone-800 block">
                      {pdfFileName ? pdfFileName : "Clique para selecionar o PDF ou arraste para cá"}
                    </span>
                    <span className="text-[10px] text-stone-400 block mt-0.5">
                      Suporta briefings técnicos, orçamentos e manuais
                    </span>
                  </div>

                  {pdfTextSample && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-stone-700">Amostra do Texto Extraído</label>
                      <textarea
                        value={pdfTextSample}
                        onChange={(e) => setPdfTextSample(e.target.value)}
                        className="w-full h-28 p-3 bg-stone-50 border border-stone-200 rounded-xl font-mono text-xs text-stone-800 leading-relaxed focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* IMAGE FLOW */}
              {selectedType === "image" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-stone-700 block">Ativo de Imagem</label>
                    {imageBase64 ? (
                      <div className="border border-stone-200 rounded-2xl p-3 bg-stone-50 text-center space-y-2">
                        <img src={imageBase64} alt="Preview" className="max-h-48 mx-auto rounded-lg object-contain" referrerPolicy="no-referrer" />
                        <button
                          type="button"
                          onClick={() => { setImageFile(null); setImageBase64(""); }}
                          className="text-xs text-red-600 hover:underline font-bold"
                        >
                          Remover Imagem
                        </button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-stone-300 hover:border-purple-400 rounded-2xl p-6 text-center bg-stone-50 cursor-pointer relative h-48 flex flex-col items-center justify-center">
                        <input type="file" accept="image/*" onChange={handleImageFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                        <UploadCloud className="w-8 h-8 text-purple-600 mb-2" />
                        <span className="text-xs font-bold text-stone-800">Selecione uma imagem de produto/capa</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-stone-700">Título do Ativo</label>
                      <input
                        type="text"
                        value={imageTitle}
                        onChange={(e) => setImageTitle(e.target.value)}
                        placeholder="Ex: Mockup Planner Wire-o Bronze"
                        className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-stone-700">Descrição / Aplicação</label>
                      <textarea
                        value={imageDescription}
                        onChange={(e) => setImageDescription(e.target.value)}
                        placeholder="Detalhes visuais, gramatura do miolo e acabamento..."
                        className="w-full h-24 p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* YOUTUBE FLOW */}
              {selectedType === "youtube" && (
                <div className="space-y-4 max-w-xl">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-700">URL do Vídeo</label>
                    <input
                      type="text"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-700">Título / Tema (Opcional)</label>
                    <input
                      type="text"
                      value={youtubeTitle}
                      onChange={(e) => setYoutubeTitle(e.target.value)}
                      placeholder="Ex: Como Vender Planners no Fim de Ano"
                      className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs"
                    />
                  </div>
                </div>
              )}

              {/* SITE FLOW */}
              {selectedType === "site" && (
                <div className="space-y-4 max-w-xl">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-700">URL da Página / Artigo</label>
                    <input
                      type="text"
                      value={siteUrl}
                      onChange={(e) => setSiteUrl(e.target.value)}
                      placeholder="https://exemplo.com/artigo-papelaria"
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-700">Título (Opcional)</label>
                    <input
                      type="text"
                      value={siteTitle}
                      onChange={(e) => setSiteTitle(e.target.value)}
                      placeholder="Ex: Guia de Gramaturas de Papel"
                      className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs"
                    />
                  </div>
                </div>
              )}

              {/* TEXT FLOW */}
              {selectedType === "text" && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-700">Título da Nota / Ideia</label>
                    <input
                      type="text"
                      value={rawTextTitle}
                      onChange={(e) => setRawTextTitle(e.target.value)}
                      placeholder="Ex: Roteiro para Stories de Tiragem Sob Demanda"
                      className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-700">Conteúdo Bruto / Anotação</label>
                    <textarea
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      placeholder="Cole ou digite aqui suas anotações, ideias e dados brutos..."
                      className="w-full h-40 p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {/* GOOGLE DRIVE FLOW */}
              {selectedType === "gdrive" && (
                <GoogleDriveSelector
                  onSelectFile={handleGoogleDriveFileSelected}
                  onCancel={() => setSelectedType(null)}
                />
              )}

              {/* ACTIONS */}
              {selectedType !== "gdrive" && (
                <div className="pt-4 border-t border-stone-150 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedType(null)}
                    className="px-4 py-2 text-stone-500 hover:text-stone-800 text-xs font-bold rounded-xl"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleStartProcessing}
                    className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>Processar e Gerar Prévia de Curadoria</span>
                  </button>
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* 4. PROCESSING STATE ANIMATION */}
      {isProcessing && (
        <div className="bg-white rounded-3xl border border-stone-200/80 p-8 sm:p-12 shadow-xs max-w-2xl mx-auto text-center space-y-6 animate-fadeIn">
          <div className="w-14 h-14 bg-purple-50 text-purple-700 border border-purple-150 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-widest block">
              Curador do Obsidian Ativo
            </span>
            <h2 className="text-lg font-black text-stone-900 mt-1">
              Extraindo e Estruturando Conhecimento
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Aplicando regras de taxonomia e preparando proposta de validação humana.
            </p>
          </div>
          <div className="space-y-2">
            <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
              <div className="bg-purple-600 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-stone-500">
              <span className="font-mono font-bold text-purple-700">{progress}%</span>
              <span className="italic">{progressMessage}</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. HUMAN-IN-THE-LOOP CURATION PANEL (PRÉVIA & CONFIRMAÇÃO HUMANA) */}
      {curationProposal && !isProcessing && (
        <div className="bg-white rounded-3xl border border-stone-200/80 p-6 sm:p-8 shadow-xs max-w-4xl mx-auto space-y-6 animate-fadeIn">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-150">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 uppercase">
                  Validação Humana Obrigatória
                </span>
                <span className="text-xs text-stone-400 font-medium">
                  Revise antes de gravar no Obsidian
                </span>
              </div>
              <h2 className="text-xl font-black text-stone-900 tracking-tight mt-1">
                Curadoria de Conhecimento: {curationProposal.title}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurationViewMode(curationViewMode === "preview" ? "edit" : "preview")}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                {curationViewMode === "preview" ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{curationViewMode === "preview" ? "Editar Markdown" : "Ver Formatado"}</span>
              </button>
            </div>
          </div>

          {/* Configuration Form: Destination Folder, Status, Title */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-stone-50/60 p-4 rounded-2xl border border-stone-200/70 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-stone-700 block">Título da Nota</label>
              <input
                type="text"
                value={curationProposal.title}
                onChange={(e) => setCurationProposal({ ...curationProposal, title: e.target.value })}
                className="w-full p-2 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-900"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-stone-700 block">Pasta no Cofre Obsidian</label>
              <select
                value={curationProposal.folder}
                onChange={(e) => setCurationProposal({ ...curationProposal, folder: e.target.value })}
                className="w-full p-2 bg-white border border-stone-200 rounded-xl text-xs font-mono font-bold text-purple-900"
              >
                {STANDARD_VAULT_FOLDERS.map((f) => (
                  <option key={f} value={f}>
                    📁 {f}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-stone-700 block">Estado do Conhecimento</label>
              <select
                value={curationProposal.status}
                onChange={(e) => setCurationProposal({ ...curationProposal, status: e.target.value as KnowledgeStatus })}
                className={`w-full p-2 bg-white border rounded-xl text-xs font-bold ${
                  curationProposal.status === "OFICIAL"
                    ? "border-emerald-300 text-emerald-800"
                    : curationProposal.status === "EM REVISÃO"
                    ? "border-amber-300 text-amber-800"
                    : "border-blue-300 text-blue-800"
                }`}
              >
                <option value="NOVO">NOVO (Rascunho inicial)</option>
                <option value="EM REVISÃO">EM REVISÃO (Pendente de dados)</option>
                <option value="OFICIAL">OFICIAL (Guia a IA automaticamente)</option>
              </select>
            </div>
          </div>

          {/* Highlights & Hypotheses Callouts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-purple-50/40 rounded-2xl border border-purple-150 space-y-2">
              <span className="font-bold text-purple-950 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                <span>Evidências Extraídas</span>
              </span>
              <ul className="space-y-1 text-stone-700">
                {curationProposal.evidence.map((ev, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-purple-600 font-bold">•</span>
                    <span>{ev}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-emerald-50/40 rounded-2xl border border-emerald-150 space-y-2">
              <span className="font-bold text-emerald-950 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Aplicações em Marketing Nisti</span>
              </span>
              <ul className="space-y-1 text-stone-700">
                {curationProposal.marketingHypotheses.map((hyp, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>{hyp}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Content Viewer / Editor */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-stone-700 block">Prévia do Conteúdo Markdown</span>
            {curationViewMode === "edit" ? (
              <textarea
                value={curationProposal.content}
                onChange={(e) => setCurationProposal({ ...curationProposal, content: e.target.value })}
                className="w-full h-64 p-4 bg-stone-50 border border-stone-200 rounded-2xl font-mono text-xs text-stone-900 leading-relaxed"
              />
            ) : (
              <div className="p-5 bg-stone-50 border border-stone-200 rounded-2xl text-xs space-y-3 font-sans max-h-64 overflow-y-auto leading-relaxed text-stone-800">
                {(curationProposal.content || "").split("\n\n").map((para, idx) => {
                  if (para.startsWith("# ")) return <h1 key={idx} className="text-base font-black text-stone-900">{para.replace("# ", "")}</h1>;
                  if (para.startsWith("## ")) return <h2 key={idx} className="text-sm font-bold text-stone-900 pt-1">{para.replace("## ", "")}</h2>;
                  if (para.startsWith("- ")) return <p key={idx} className="pl-3 text-stone-700 font-mono">{para}</p>;
                  return <p key={idx}>{para}</p>;
                })}
              </div>
            )}
          </div>

          {/* Confirmation & Routing Buttons */}
          <div className="pt-4 border-t border-stone-150 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setCurationProposal(null)}
              className="px-4 py-2 text-stone-500 hover:text-stone-800 text-xs font-bold rounded-xl"
            >
              Cancelar & Descartar
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleConfirmAndSave(true)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl border border-stone-200 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Salva na pasta 00_Inbox como rascunho NOVO"
              >
                <Inbox className="w-3.5 h-3.5 text-stone-500" />
                <span>Salvar em 00_Inbox</span>
              </button>

              <button
                onClick={() => handleConfirmAndSave(false)}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar e Gravar no Obsidian</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* 6. SUCCESS STATE */}
      {createdNote && !isProcessing && (
        <div className="bg-white rounded-3xl border border-stone-200/80 p-6 sm:p-8 shadow-xs max-w-2xl mx-auto space-y-6 animate-fadeIn">
          <div className="flex items-start gap-4 pb-4 border-b border-stone-150">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-700 border border-emerald-150 rounded-2xl flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                Nota Gravada com Sucesso no Cofre
              </span>
              <h2 className="text-lg font-black text-stone-900">
                {createdNote.title}
              </h2>
              <p className="text-xs text-stone-500 font-mono mt-0.5">
                📁 {createdNote.path} • Status: <span className="font-bold text-stone-800">{createdNote.frontmatter.status}</span>
              </p>
            </div>
          </div>

          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/70 space-y-2 text-xs">
            <span className="font-bold text-stone-700 block">Conexões Atômicas (Backlinks):</span>
            <div className="flex flex-wrap gap-1.5">
              {relations.map((rel, i) => (
                <span key={i} className="px-2.5 py-1 bg-purple-50 text-purple-900 rounded-lg border border-purple-150 font-mono text-[11px] font-bold flex items-center gap-1">
                  <Link2 className="w-3 h-3 text-purple-500" />
                  <span>[[{rel}]]</span>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              + Adicionar Outra Nota
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenNoteInVault}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl cursor-pointer shadow-3xs"
              >
                Ver no Navegador de Notas
              </button>
              <a
                href={buildObsidianOpenUri(apiConfig.vaultName, createdNote.path)}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1"
              >
                <span>Abrir no Obsidian</span>
                <ExternalLink className="w-3.5 h-3.5 text-purple-300" />
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
