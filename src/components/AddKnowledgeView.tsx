import React, { useState } from "react";
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
  RotateCcw
} from "lucide-react";
import { ObsidianNote, ObsidianApiConfig } from "../types";

interface AddKnowledgeViewProps {
  notes: ObsidianNote[];
  onAddNote: (newNote: ObsidianNote) => void;
  apiConfig: ObsidianApiConfig;
  onNavigateTab: (tab: "dashboard" | "vault" | "campaigns" | "tasks" | "automations" | "routine") => void;
  onSelectNote: (note: ObsidianNote) => void;
  engineMode: "local" | "ai";
}

type KnowledgeType = "pdf" | "image" | "youtube" | "site" | "text";

interface ProgressStep {
  percentage: number;
  message: string;
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
  
  // Form values
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>("");
  const [pdfTextSample, setPdfTextSample] = useState<string>("");
  
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageTitle, setImageTitle] = useState<string>("");
  const [imageDescription, setImageDescription] = useState<string>("");
  const [imageCategory, setImageCategory] = useState<string>("Referências/Imagens");
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

  // UI Processing states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Success summary report states
  const [createdNote, setCreatedNote] = useState<ObsidianNote | null>(null);
  const [relations, setRelations] = useState<string[]>([]);
  const [wasFallback, setWasFallback] = useState<boolean>(false);

  // Options for mock/example inputs to facilitate frictionless user testing
  const useExampleInput = (type: KnowledgeType) => {
    setError(null);
    if (type === "pdf") {
      setPdfFileName("Estudo_Mercado_DevOps_SaaS_2026.pdf");
      setPdfTextSample(`ESTUDO DE MERCADO: ADOÇÃO DE FERRAMENTAS DE INTEGRAÇÃO DE CONHECIMENTO B2B
Autor: DevOps Intelligence Group
Data: Julho 2026

1. Resumo Executivo: Equipes ágeis de engenharia de software sofrem de fadiga de ferramentas. Silos de informação reduzem a produtividade de engenharia em até 30%. Líderes técnicos como Tech Leads (Tech Lead Rodrigo) buscam avidamente soluções baseadas em Markdown limpo que se integram localmente às suas máquinas sem comprometer a segurança. O uso de bases de conhecimento do Obsidian integradas com automação (Obsidian Local REST API) cresce como principal alternativa corporativa.

2. Gatilhos de Conversão Técnicos:
- Transparência total e propriedade dos arquivos (.md).
- Menos cliques, mais velocidade (atalhos de teclado, interfaces minimalistas).
- Integração profunda com fluxos de tarefas e rotinas semanais.`);
    } else if (type === "image") {
      setImageTitle("Infográfico SaaS Growth Funnel");
      setImageDescription("Visual mostrando as etapas de atração, conversão de leads DevOps e rotas de expansão de conta via newsletters e LinkedIn.");
      setImageCategory("Campanhas/Infográficos");
      setImageKeywords("funnel, growth-hacking, b2b-marketing, infographic");
      setImageBase64("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
    } else if (type === "youtube") {
      setYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      setYoutubeTitle("Como Escalar o SEO de sua Startup B2B de forma Atômica");
      setYoutubeChannel("SaaS Academy");
    } else if (type === "site") {
      setSiteUrl("https://growthengine.com/blog/persuasion-frameworks-copywriting");
      setSiteTitle("Frameworks de Persuasão em Copywriting B2B: PAS vs AIDA");
    } else if (type === "text") {
      setRawTextTitle("Ideias de Headlines de Alta Conversão para Anúncios no LinkedIn");
      setRawText(`Aqui estão algumas ideias preliminares para novos anúncios direcionados ao Rodrigo (Tech Lead):

1. "Menos Cliques, Mais Código: Uma Base de Conhecimento Obsidian Construída para Engenheiros."
2. "Sua documentação está desatualizada? Sincronize suas metas com Markdown Nativo e elimine silos no Notion."
3. "Segurança e Controle Local: O Gestor de Marketing que respeita a privacidade de dados da sua empresa."

Esses anúncios devem ser direcionados para as diretrizes de tom autoritário estabelecidas no nosso Brand Voice & Posicionamento, e casam diretamente com as dores identificadas na Persona - Tech Lead Rodrigo.`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPdfFile(file);
      setPdfFileName(file.name);
      setPdfTextSample(`[Leitura Automatizada do arquivo PDF '${file.name}']: Este arquivo de ${Math.round(file.size / 1024)} KB foi importado com sucesso. Ele contém tópicos técnicos relacionados a estratégias de branding, copy persuasivo, fluxos de distribuição de conteúdo orgânico e dres de personas.`);
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

  const handleStartProcessing = async () => {
    setError(null);
    setCreatedNote(null);
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
    if (selectedType === "image" && !imageDescription && !imageBase64) {
      setError("Por favor, adicione uma descrição ou anexe uma imagem para análise automática.");
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

    // Steps to simulate elegant, realistic visual progression
    const steps: ProgressStep[] = [
      { percentage: 12, message: "Lendo e limpando formatação do conteúdo..." },
      { percentage: 28, message: "Analisando estrutura de dados e extraindo metadados..." },
      { percentage: 45, message: "Enviando para o Motor IA para extração de resumo e palavras-chave..." },
      { percentage: 68, message: "Mapeando e gerando relações de backlinks inteligentes..." },
      { percentage: 85, message: "Determinando classificação de taxonomia de pastas automaticamente..." },
      { percentage: 95, message: "Sincronizando e gravando nota Markdown no cofre..." },
      { percentage: 100, message: "Nota salva com sucesso!" }
    ];

    // Build the request payload
    let payload: any = {};
    if (selectedType === "pdf") {
      payload = { fileName: pdfFileName, textContentSample: pdfTextSample };
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

    // Interval to animate progress visually while background request occurs
    let currentStepIdx = 0;
    const progressInterval = setInterval(() => {
      if (currentStepIdx < steps.length - 2) {
        currentStepIdx++;
        setProgress(steps[currentStepIdx].percentage);
        setProgressMessage(steps[currentStepIdx].message);
      }
    }, 450);

    try {
      // Execute backend API request
      const response = await fetch("/api/gemini/process-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selectedType, payload })
      });

      if (!response.ok) {
        throw new Error(`Erro no servidor: Código ${response.status}`);
      }

      const resData = await response.json();
      
      clearInterval(progressInterval);
      setProgress(95);
      setProgressMessage("Gravando nota Markdown de forma estruturada...");

      if (resData.success && resData.data) {
        const aiData = resData.data;

        // Create the official ObsidianNote object based on results
        const newNoteId = `note-captured-${Date.now()}`;
        const newNotePath = `${aiData.folder || "06 - Referências"}/${aiData.title}.md`;

        const newNote: ObsidianNote = {
          id: newNoteId,
          path: newNotePath,
          title: aiData.title,
          folder: aiData.folder || "06 - Referências",
          content: aiData.content,
          tags: aiData.keywords || aiData.tags || ["conhecimento"],
          wikilinks: aiData.wikilinks || [],
          frontmatter: {
            title: aiData.title,
            tags: aiData.keywords || aiData.tags || ["conhecimento"],
            category: aiData.category || "Auto-Captura",
            source_url: payload.url || undefined,
            captured_date: new Date().toISOString().split("T")[0],
          },
          lastModified: new Date().toISOString().replace("T", " ").substring(0, 16),
          syncedWithApi: apiConfig.connectionStatus === "connected"
        };

        // Add to global state
        onAddNote(newNote);
        
        // Brief pause to feel premium
        await new Promise(r => setTimeout(r, 600));

        setProgress(100);
        setProgressMessage("Organizado com sucesso!");
        
        // Save outputs
        setCreatedNote(newNote);
        setRelations(aiData.wikilinks || []);
        setWasFallback(!!resData.wasFallback);
      } else {
        throw new Error("Resposta inválida da API do servidor");
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      setError(`Ocorreu um erro ao processar o conhecimento automaticamente: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
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
    setCreatedNote(null);
    setRelations([]);
  };

  const handleOpenNoteInVault = () => {
    if (createdNote) {
      onSelectNote(createdNote);
      onNavigateTab("vault");
    }
  };

  // Render option cards
  const knowledgeOptions = [
    {
      id: "pdf" as const,
      label: "Arquivo PDF",
      icon: FileText,
      color: "bg-red-50 text-red-700 border-red-150 hover:border-red-300",
      description: "Importa PDFs de briefings, relatórios ou pesquisas com extração e resumo automatizados."
    },
    {
      id: "image" as const,
      label: "Ativo de Imagem",
      icon: ImageIcon,
      color: "bg-blue-50 text-blue-700 border-blue-150 hover:border-blue-300",
      description: "Catalogação automática de prints, criativos e infográficos com ALT-text SEO."
    },
    {
      id: "youtube" as const,
      label: "Vídeo do YouTube",
      icon: Youtube,
      color: "bg-rose-50 text-rose-700 border-rose-150 hover:border-rose-300",
      description: "Incorpore vídeos do YouTube. Extrai título, canal, ganchos e gera resumos atômicos."
    },
    {
      id: "site" as const,
      label: "Página Web / Site",
      icon: Globe,
      color: "bg-indigo-50 text-indigo-700 border-indigo-150 hover:border-indigo-300",
      description: "Extrai artigos, guias de concorrência ou tendências da web direto em Markdown limpo."
    },
    {
      id: "text" as const,
      label: "Texto / Rascunho Livre",
      icon: AlignLeft,
      color: "bg-amber-50 text-amber-700 border-amber-150 hover:border-amber-300",
      description: "Escreva ou cole ideias sem rumo. O sistema classifica, tagueia e linca com seu cofre."
    }
  ];

  const buildObsidianOpenUri = (vault: string, notePath: string) => {
    return `obsidian://open?vault=${encodeURIComponent(vault || "Obsidian")}&file=${encodeURIComponent(notePath)}`;
  };

  return (
    <div className="w-full px-4 md:px-8 lg:px-12 space-y-8 pb-20 animate-fadeIn">
      
      {/* 1. CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/60">
        <div>
          <span className="text-[10px] font-bold text-purple-700 uppercase tracking-widest block mb-1">
            Módulo Inteligente
          </span>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">
            Central de Conhecimento Atômico
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Colete dados brutos. O organizador automático cria metadados, tagueia e correlaciona tudo no cofre.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-stone-600 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200/70">
            📂 {notes.length} Notas Catalogadas
          </span>
          {engineMode === "ai" && (
            <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1.5 rounded-xl border border-purple-200 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Organizador IA Ativo</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. ERROR STATE */}
      {error && (
        <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-2xl flex items-start gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold">Ocorreu um problema no processamento</span>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* 3. CORE INTERFACE FLOW */}
      {!createdNote && !isProcessing && (
        <div className="space-y-8">
          
          {/* STEP A: CHOOSE TYPE */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
              1. Selecione o Tipo de Conhecimento a Adicionar
            </span>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {knowledgeOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedType === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setSelectedType(opt.id);
                      setError(null);
                    }}
                    className={`p-5 rounded-2xl border text-left transition-all relative flex flex-col justify-between h-full group cursor-pointer ${
                      isSelected
                        ? "bg-white border-purple-600 ring-2 ring-purple-100 shadow-sm"
                        : "bg-white border-stone-200/80 hover:border-stone-300 hover:shadow-2xs"
                    }`}
                  >
                    <div className="space-y-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        isSelected ? "bg-purple-600 text-white border-purple-600" : "bg-stone-50 text-stone-700 border-stone-200/80"
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-stone-900 block">
                          {opt.label}
                        </span>
                        <p className="text-[10px] text-stone-500 leading-relaxed">
                          {opt.description}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="absolute top-4 right-4 w-5 h-5 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-[10px] font-bold">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP B: INPUT FORM DATA */}
          {selectedType && (
            <div className="bg-white rounded-3xl border border-stone-200/80 p-6 sm:p-8 shadow-xs space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between pb-4 border-b border-stone-150">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-900 uppercase tracking-wider bg-stone-100 px-2.5 py-1 rounded-lg">
                    {selectedType.toUpperCase()}
                  </span>
                  <span className="text-xs text-stone-500">
                    Insira as informações básicas abaixo
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => useExampleInput(selectedType)}
                  className="px-3 py-1.5 text-[11px] font-bold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-200 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Usar Exemplo de Teste</span>
                </button>
              </div>

              {/* PDF FLOW */}
              {selectedType === "pdf" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-stone-700 block">
                      Fazer Upload do Arquivo PDF
                    </label>
                    <div className="border-2 border-dashed border-stone-200 hover:border-purple-300 rounded-2xl p-8 text-center transition-colors relative cursor-pointer group bg-stone-50/40">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="space-y-3">
                        <div className="w-12 h-12 bg-stone-100 text-stone-500 group-hover:text-purple-600 group-hover:bg-purple-50 border border-stone-200 rounded-xl flex items-center justify-center mx-auto transition-all">
                          <UploadCloud className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-stone-800 block">
                            Arraste ou selecione seu PDF aqui
                          </span>
                          <span className="text-[10px] text-stone-400 block mt-0.5">
                            Extração automática de texto integrada
                          </span>
                        </div>
                      </div>
                    </div>
                    {pdfFileName && (
                      <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-purple-600 shrink-0" />
                          <span className="text-xs font-mono font-bold text-stone-800 truncate max-w-[280px]">
                            {pdfFileName}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPdfFile(null);
                            setPdfFileName("");
                            setPdfTextSample("");
                          }}
                          className="text-[10px] text-red-600 hover:underline font-bold"
                        >
                          Remover
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-700 flex items-center justify-between">
                      <span>Texto Extraído (Amostra opcional)</span>
                      <span className="text-[10px] text-stone-400 font-normal">Amostra de 1000 palavras para IA</span>
                    </label>
                    <textarea
                      value={pdfTextSample}
                      onChange={(e) => setPdfTextSample(e.target.value)}
                      placeholder="Cole um rascunho de texto extraído do seu PDF aqui se preferir acelerar o processo, ou deixe o assistente criar uma simulação inteligente a partir do título do arquivo..."
                      className="w-full h-[180px] p-4 border border-stone-250 rounded-2xl text-xs focus:ring-1 focus:ring-purple-600 focus:border-purple-600 resize-none font-sans leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {/* IMAGE FLOW */}
              {selectedType === "image" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Image Dropzone & Preview */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-stone-700 block">
                      Anexar Ativo de Imagem
                    </label>
                    
                    {imageBase64 ? (
                      <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50 flex flex-col items-center justify-center space-y-3 relative group">
                        <div className="w-full max-h-[220px] overflow-hidden rounded-xl border border-stone-200/80 bg-white flex items-center justify-center">
                          <img 
                            src={imageBase64} 
                            alt="Preview do ativo de imagem" 
                            className="max-h-[220px] object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex items-center justify-between w-full text-xs px-1">
                          <span className="text-stone-500 font-mono font-bold truncate max-w-[180px]">
                            {imageFile ? imageFile.name : "exemplo_imagem.png"}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setImageFile(null);
                              setImageBase64("");
                            }}
                            className="text-red-600 hover:text-red-700 font-bold hover:underline cursor-pointer"
                          >
                            Remover Imagem
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative border-2 border-dashed border-stone-300 hover:border-purple-400 rounded-2xl transition duration-150 flex flex-col items-center justify-center p-6 text-center bg-stone-50 hover:bg-stone-50/50 cursor-pointer h-[274px]">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="p-3 bg-purple-50 text-purple-700 rounded-full mb-3">
                          <UploadCloud className="w-6 h-6 animate-pulse" />
                        </div>
                        <span className="text-xs font-bold text-stone-800">
                          Selecione ou Arraste uma Imagem
                        </span>
                        <p className="text-[10px] text-stone-400 max-w-[240px] mt-1 leading-normal">
                          PNG, JPG, WEBP ou GIF. O motor de IA lerá o conteúdo visual e gerará a nota automaticamente!
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Metadata Configuration */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-stone-700 block">
                        Título do Ativo / Nota
                      </label>
                      <input
                        type="text"
                        value={imageTitle}
                        onChange={(e) => setImageTitle(e.target.value)}
                        placeholder="Ex: Print de Anúncio SaaS ou Print do Concorrente"
                        className="w-full p-3 border border-stone-250 rounded-xl text-xs focus:ring-1 focus:ring-purple-600 focus:border-purple-600 font-sans"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-stone-700 block">
                          Categoria Sugerida
                        </label>
                        <select
                          value={imageCategory}
                          onChange={(e) => setImageCategory(e.target.value)}
                          className="w-full p-3 border border-stone-250 rounded-xl text-xs focus:ring-1 focus:ring-purple-600 focus:border-purple-600 bg-white"
                        >
                          <option value="Campanhas/Infográficos">Campanhas / Infográficos</option>
                          <option value="Referências/Imagens">Referências / Imagens Concorrentes</option>
                          <option value="Produtos/Assets">Ativos de Tela de Produto</option>
                          <option value="Copywriting/Templates">Templates Visuais de Copy</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-stone-700 flex items-center justify-between">
                          <span>Tags Adicionais</span>
                          <span className="text-[10px] text-stone-400">Separe por vírgula</span>
                        </label>
                        <input
                          type="text"
                          value={imageKeywords}
                          onChange={(e) => setImageKeywords(e.target.value)}
                          placeholder="Ex: linkedin, ui, ux, saas"
                          className="w-full p-3 border border-stone-250 rounded-xl text-xs focus:ring-1 focus:ring-purple-600 focus:border-purple-600"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-stone-700 block flex items-center justify-between">
                        <span>Descrição Adicional (Opcional)</span>
                        <span className="text-[10px] text-stone-400 font-normal">Complemente a IA se desejar</span>
                      </label>
                      <textarea
                        value={imageDescription}
                        onChange={(e) => setImageDescription(e.target.value)}
                        placeholder="Se anexar uma imagem à esquerda, o assistente lerá tudo de forma autônoma. Caso prefira guiar a IA, adicione notas de contexto adicionais aqui."
                        className="w-full h-24 p-3 border border-stone-250 rounded-xl text-xs focus:ring-1 focus:ring-purple-600 focus:border-purple-600 font-sans leading-relaxed resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* YOUTUBE FLOW */}
              {selectedType === "youtube" && (
                <div className="space-y-4 max-w-2xl">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 block">
                      URL do Vídeo do YouTube
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="Ex: https://www.youtube.com/watch?v=..."
                        className="w-full p-3.5 pr-10 border border-stone-250 rounded-xl text-xs focus:ring-1 focus:ring-purple-600 focus:border-purple-600 font-sans"
                      />
                      <Youtube className="w-4 h-4 text-stone-400 absolute right-3.5 top-3.5" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-stone-700 block">
                        Título do Vídeo (Opcional - Inteligência autocompleta se vazio)
                      </label>
                      <input
                        type="text"
                        value={youtubeTitle}
                        onChange={(e) => setYoutubeTitle(e.target.value)}
                        placeholder="Deixe em branco para inteligência deduzir"
                        className="w-full p-3 border border-stone-250 rounded-xl text-xs focus:ring-1 focus:ring-purple-600 focus:border-purple-600"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-stone-700 block">
                        Nome do Canal (Opcional)
                      </label>
                      <input
                        type="text"
                        value={youtubeChannel}
                        onChange={(e) => setYoutubeChannel(e.target.value)}
                        placeholder="Ex: SaaS Academy"
                        className="w-full p-3 border border-stone-250 rounded-xl text-xs focus:ring-1 focus:ring-purple-600 focus:border-purple-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SITE FLOW */}
              {selectedType === "site" && (
                <div className="space-y-4 max-w-2xl">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 block">
                      Endereço da Página Web (URL do Site)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={siteUrl}
                        onChange={(e) => setSiteUrl(e.target.value)}
                        placeholder="Ex: https://growth-marketing.com/analise-sistemas"
                        className="w-full p-3.5 pr-10 border border-stone-250 rounded-xl text-xs focus:ring-1 focus:ring-purple-600 focus:border-purple-600 font-sans"
                      />
                      <Globe className="w-4 h-4 text-stone-400 absolute right-3.5 top-3.5" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 block">
                      Título Aproximado / Nome do Artigo (Opcional)
                    </label>
                    <input
                      type="text"
                      value={siteTitle}
                      onChange={(e) => setSiteTitle(e.target.value)}
                      placeholder="Título da matéria para otimizar busca cognitiva"
                      className="w-full p-3 border border-stone-250 rounded-xl text-xs focus:ring-1 focus:ring-purple-600 focus:border-purple-600"
                    />
                  </div>
                </div>
              )}

              {/* TEXT FLOW */}
              {selectedType === "text" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 block">
                      Título Provisório da Nota / Ideia Central
                    </label>
                    <input
                      type="text"
                      value={rawTextTitle}
                      onChange={(e) => setRawTextTitle(e.target.value)}
                      placeholder="Ex: Rascunho da nova campanha de e-mail de setembro"
                      className="w-full p-3 border border-stone-250 rounded-xl text-xs focus:ring-1 focus:ring-purple-600 focus:border-purple-600 font-sans"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 block">
                      Conteúdo Livre (Escreva ou cole seu conhecimento bruto)
                    </label>
                    <textarea
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      placeholder="Escreva livremente aqui ideias, trechos de livros, insights de reuniões, etc. O organizador lerá tudo, determinará a melhor categoria, tags de taxonomia e fará backlinks com outras notas como [[SaaS Growth Engine]] ou [[Persona - Tech Lead Rodrigo]] automaticamente!"
                      className="w-full h-44 p-4 border border-stone-250 rounded-2xl text-xs focus:ring-1 focus:ring-purple-600 focus:border-purple-600 font-sans leading-relaxed resize-none"
                    />
                  </div>
                </div>
              )}

              {/* ACTION TRIGGER */}
              <div className="pt-4 border-t border-stone-150 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedType(null)}
                  className="px-4 py-2 text-stone-500 hover:text-stone-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleStartProcessing}
                  className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-3xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-purple-200" />
                  <span>Sintetizar e Organizar no Cofre</span>
                </button>
              </div>

            </div>
          )}

        </div>
      )}

      {/* 4. PROCESSING STATE (WITH CUSTOM STAGED PROGRESS BAR) */}
      {isProcessing && (
        <div className="bg-white rounded-3xl border border-stone-200/80 p-8 sm:p-12 shadow-xs max-w-2xl mx-auto text-center space-y-8 animate-fadeIn">
          
          <div className="space-y-3">
            <div className="w-16 h-16 bg-purple-50 text-purple-700 border border-purple-100 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-purple-700 uppercase tracking-widest block">
                Processamento Inteligente
              </span>
              <h2 className="text-lg font-black text-stone-900 mt-1">
                Sintetizando Conhecimento
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Mapeando conceitos e construindo conexões atômicas com a sua base.
              </p>
            </div>
          </div>

          {/* Progress Bar & Dynamic Messages */}
          <div className="space-y-2">
            <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden border border-stone-200/40">
              <div
                className="bg-purple-600 h-full transition-all duration-300 ease-out rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-500 font-medium">
              <span className="font-mono text-purple-700 font-bold">
                {progress}%
              </span>
              <span className="italic">
                {progressMessage}
              </span>
            </div>
          </div>

          <div className="bg-stone-50/70 p-4 rounded-xl text-[10px] text-stone-400 font-mono leading-relaxed border border-stone-150">
            [Cérebro Digital]: Analisando referências internas a {notes.length} notas existentes...
          </div>

        </div>
      )}

      {/* 5. SUCCESS SUMMARY REPORT */}
      {createdNote && !isProcessing && (
        <div className="bg-white rounded-3xl border border-stone-200/80 p-6 sm:p-8 shadow-xs max-w-3xl mx-auto space-y-6 animate-fadeIn">
          
          {/* Header check */}
          <div className="flex items-start gap-4 pb-4 border-b border-stone-150">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-700 border border-emerald-150 rounded-2xl flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                Catalogação Efetuada com Sucesso
              </span>
              <h2 className="text-lg font-black text-stone-900">
                {createdNote.title}
              </h2>
              <p className="text-xs text-stone-500">
                Salvo automaticamente na pasta: <span className="font-mono text-stone-700 font-bold">📂 {createdNote.folder}</span>
              </p>
            </div>
          </div>

          {/* Details & Relations Report Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left: Metadata generated */}
            <div className="space-y-4">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block border-b border-stone-100 pb-1.5">
                Metadados & Indexação
              </span>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500 font-medium">Tipo:</span>
                  <span className="font-bold text-stone-800 capitalize">{selectedType}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500 font-medium">Categoria do Note:</span>
                  <span className="font-bold text-stone-800">{createdNote.frontmatter.category || "Geral"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500 font-medium">Status de Sincronização:</span>
                  <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
                    Sincronizado
                  </span>
                </div>
                <div className="flex items-start justify-between text-xs gap-3">
                  <span className="text-stone-500 font-medium shrink-0">Palavras-chave:</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {createdNote.tags.map((tag, idx) => (
                      <span key={idx} className="text-[10px] font-mono font-bold bg-stone-100 text-stone-700 px-2 py-0.5 rounded border border-stone-200/60">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Relations / Backlinks Created */}
            <div className="space-y-4">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block border-b border-stone-100 pb-1.5">
                Relações Criadas (Backlinks [[...]])
              </span>

              {relations.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-stone-500 font-medium">
                    O sistema analisou os conceitos e conectou automaticamente esta nova nota às seguintes referências do seu cofre:
                  </p>
                  <div className="space-y-1.5">
                    {relations.map((rel, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-1.5 bg-purple-50/50 border border-purple-100 rounded-xl text-xs font-bold text-purple-900 flex items-center gap-1.5"
                      >
                        <Link2 className="w-3.5 h-3.5 text-purple-500" />
                        <span>[[{rel}]]</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl text-center">
                  <span className="text-xs text-stone-500 block font-medium">Nenhum backlink explícito mapeado.</span>
                  <p className="text-[10px] text-stone-400 mt-1 leading-relaxed">
                    A nota foi indexada apenas na taxonomia de pastas principal por enquanto.
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* Total Notes metric */}
          <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-stone-500" />
              <div>
                <span className="text-xs font-bold text-stone-900 block">Total de Conhecimento do Cofre</span>
                <span className="text-[10px] text-stone-400 block">Organizado inteiramente sem pastas manuais</span>
              </div>
            </div>
            <span className="text-lg font-black text-stone-800">
              {notes.length} Notas
            </span>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-stone-150 flex flex-wrap items-center justify-between gap-4">
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl text-stone-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
              <span>Adicionar Outro Conhecimento</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenNoteInVault}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl transition-all shadow-3xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>Ver Nota Criada</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <a
                href={buildObsidianOpenUri(apiConfig.vaultName, createdNote.path)}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold rounded-xl transition-all shadow-3xs flex items-center gap-1.5 text-center"
              >
                <span>Abrir no Obsidian</span>
                <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
              </a>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
