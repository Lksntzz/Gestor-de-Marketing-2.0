import React, { useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  Check,
  CheckCircle2,
  Cloud,
  FileText,
  Globe,
  Image as ImageIcon,
  Link2,
  Loader2,
  RotateCcw,
  Sparkles,
  Tag,
  Trash2,
  UploadCloud,
  Youtube,
} from "lucide-react";
import { EngineMode, KnowledgeStatus, ObsidianApiConfig, ObsidianNote } from "../types";
import { STANDARD_VAULT_FOLDERS } from "../data/defaultVault";
import { GoogleDriveSelector } from "./GoogleDriveSelector";

interface AddKnowledgeViewProps {
  notes: ObsidianNote[];
  onAddNote: (newNote: ObsidianNote) => void;
  apiConfig: ObsidianApiConfig;
  onNavigateTab: (tab: "dashboard" | "vault" | "campaigns" | "tasks" | "automations" | "routine") => void;
  onSelectNote: (note: ObsidianNote) => void;
  engineMode: EngineMode;
}

type KnowledgeType = "site" | "pdf" | "youtube" | "image" | "text" | "gdrive";

type CurationProposal = {
  title: string;
  folder: string;
  status: KnowledgeStatus;
  tipo: string;
  category: string;
  keywords: string[];
  wikilinks: string[];
  content: string;
  summary: string;
  sourceUrl?: string;
};

const TYPE_OPTIONS: Array<{ id: KnowledgeType; label: string; icon: React.ElementType }> = [
  { id: "site", label: "URL Web", icon: Link2 },
  { id: "pdf", label: "PDF Document", icon: FileText },
  { id: "youtube", label: "YouTube", icon: Youtube },
  { id: "image", label: "Imagem / OCR", icon: ImageIcon },
  { id: "text", label: "Texto Livre", icon: AlignLeft },
  { id: "gdrive", label: "Drive Sync", icon: Cloud },
];

function cleanBase64(value: string) {
  const commaIndex = value.indexOf(",");
  return commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
}

async function callKnowledgeProcessor(type: KnowledgeType, payload: any, engineMode: EngineMode) {
  const requestPayload = { type, payload, engineMode };
  if (window.electronAPI?.processKnowledgeLocal) {
    return window.electronAPI.processKnowledgeLocal(requestPayload);
  }

  const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
  const sessionData = await sessionResponse.json().catch(() => ({}));
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (sessionData?.token) headers["x-app-session-token"] = sessionData.token;

  const response = await fetch("/api/gemini/process-knowledge", {
    method: "POST",
    headers,
    body: JSON.stringify(requestPayload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Erro HTTP ${response.status}`);
  return data;
}

export const AddKnowledgeView: React.FC<AddKnowledgeViewProps> = ({
  notes: _notes,
  onAddNote,
  apiConfig,
  onNavigateTab,
  onSelectNote,
  engineMode,
}) => {
  const [selectedType, setSelectedType] = useState<KnowledgeType>("site");
  const [textValue, setTextValue] = useState("");
  const [titleValue, setTitleValue] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileBase64, setFileBase64] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<CurationProposal | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const connected = apiConfig.connectionStatus === "connected";

  const pipelineSteps = useMemo(() => [
    { label: "Extração de Conteúdo", detail: progress >= 25 ? "Conteúdo recebido e preparado para análise." : "Aguardando fonte." },
    { label: "Análise Semântica (LLM)", detail: progress >= 55 ? "Estrutura, tópicos e contexto identificados." : "Aguardando extração." },
    { label: "Proposta de Curadoria", detail: proposal ? "Metadados, links e resumo prontos para revisão." : progress >= 80 ? "Gerando metadados e conexões..." : "Aguardando análise." },
    { label: "Revisão Humana", detail: proposal ? "Aguardando aprovação antes de gravar no Vault." : "Aguardando proposta." },
  ], [progress, proposal]);

  const reset = () => {
    setTextValue("");
    setTitleValue("");
    setFileName("");
    setFileBase64("");
    setProposal(null);
    setProgress(0);
    setError(null);
  };

  const handleTypeChange = (type: KnowledgeType) => {
    setSelectedType(type);
    reset();
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    if (!titleValue) setTitleValue(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
    const reader = new FileReader();
    reader.onload = () => setFileBase64(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const buildPayload = () => {
    if (selectedType === "site") return { url: textValue.trim(), pageTitle: titleValue.trim() || undefined };
    if (selectedType === "youtube") return { url: textValue.trim(), videoTitle: titleValue.trim() || undefined };
    if (selectedType === "text") return { text: textValue, title: titleValue.trim() };
    if (selectedType === "pdf") return { fileName, textContentSample: titleValue.trim(), base64: cleanBase64(fileBase64) };
    if (selectedType === "image") return { title: titleValue.trim() || fileName, description: textValue.trim(), imageBase64: fileBase64 || undefined };
    return { text: textValue, title: titleValue.trim() || fileName };
  };

  const validate = () => {
    if (selectedType === "site" || selectedType === "youtube") return Boolean(textValue.trim());
    if (selectedType === "text") return Boolean(titleValue.trim() && textValue.trim());
    if (selectedType === "pdf" || selectedType === "image") return Boolean(fileName || fileBase64);
    return Boolean(textValue.trim() || fileName);
  };

  const processSource = async () => {
    setError(null);
    setProposal(null);
    if (!validate()) {
      setError("Preencha ou selecione a fonte antes de processar.");
      return;
    }

    setIsProcessing(true);
    setProgress(20);
    const timer = window.setInterval(() => setProgress((value) => Math.min(value + 12, 88)), 350);
    try {
      const result = await callKnowledgeProcessor(selectedType, buildPayload(), engineMode);
      if (!result?.success || !result?.data) throw new Error(result?.error || "A IA não retornou uma proposta de curadoria.");
      const data = result.data;
      const folderCandidate = String(data.folder || "00_Inbox");
      const folder = STANDARD_VAULT_FOLDERS.includes(folderCandidate) ? folderCandidate : "00_Inbox";
      const content = String(data.content || data.summary || data.text || "").trim();
      const summary = String(data.summary || content.split(/\n+/).filter(Boolean).slice(0, 3).join(" ")).slice(0, 900);
      setProposal({
        title: String(data.title || titleValue || fileName || "Novo Conhecimento").trim(),
        folder,
        status: folder === "00_Inbox" ? "NOVO" : "EM REVISÃO",
        tipo: selectedType === "pdf" ? "Documento PDF" : selectedType === "image" ? "Imagem / OCR" : selectedType === "youtube" ? "Vídeo" : selectedType === "site" ? "Página Web" : "Texto",
        category: String(data.category || "Conhecimento"),
        keywords: Array.isArray(data.keywords) ? data.keywords.slice(0, 8) : Array.isArray(data.tags) ? data.tags.slice(0, 8) : [],
        wikilinks: Array.isArray(data.wikilinks) ? data.wikilinks.slice(0, 8) : [],
        content,
        summary,
        sourceUrl: selectedType === "site" || selectedType === "youtube" ? textValue.trim() : undefined,
      });
      setProgress(100);
    } catch (err: any) {
      setError(err.message || "Falha ao processar conhecimento.");
      setProgress(0);
    } finally {
      window.clearInterval(timer);
      setIsProcessing(false);
    }
  };

  const approveAndSave = async () => {
    if (!proposal || !connected) return;
    setIsSaving(true);
    setError(null);
    const now = new Date().toISOString();
    const safeTitle = proposal.title.replace(/[<>:"/\\|?*]/g, "_").trim() || "Novo Conhecimento";
    const path = `${proposal.folder}/${safeTitle}.md`;
    const frontmatter = {
      id: `knowledge_${Date.now()}`,
      tipo: proposal.tipo,
      status: proposal.status,
      category: proposal.category,
      tags: proposal.keywords,
      origem: proposal.sourceUrl || selectedType,
      created_at: now.slice(0, 10),
      updated_at: now.slice(0, 10),
    };

    try {
      if (window.electronAPI?.writeNote) {
        const writeResult = await window.electronAPI.writeNote(proposal.folder, safeTitle, proposal.content, frontmatter);
        if (!writeResult.success) throw new Error(writeResult.error || "Não foi possível gravar a nota no Vault.");
      }

      const newNote: ObsidianNote = {
        id: String(frontmatter.id),
        path,
        title: safeTitle,
        folder: proposal.folder,
        content: proposal.content,
        frontmatter,
        tags: proposal.keywords,
        wikilinks: proposal.wikilinks,
        lastModified: now,
        syncedWithApi: true,
      };
      onAddNote(newNote);
      onSelectNote(newNote);
      onNavigateTab("vault");
    } catch (err: any) {
      setError(err.message || "Falha ao salvar no Vault.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderInput = () => {
    if (selectedType === "gdrive") {
      return (
        <div className="pt-2">
          <GoogleDriveSelector
            onFileSelected={(fileData: any) => {
              setFileName(fileData.name || "Arquivo do Drive");
              setTitleValue(String(fileData.name || "").replace(/\.[^/.]+$/, ""));
              setTextValue(fileData.contentText || "");
              setFileBase64(fileData.base64 || "");
              if (fileData.isPdf) setSelectedType("pdf");
              else if (String(fileData.mimeType || "").startsWith("image/")) setSelectedType("image");
              else setSelectedType("text");
            }}
          />
        </div>
      );
    }

    if (selectedType === "pdf" || selectedType === "image") {
      return (
        <div className="space-y-3">
          <input ref={fileInputRef} type="file" accept={selectedType === "pdf" ? ".pdf,application/pdf" : "image/*"} className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-12 border border-dashed border-[#475569] bg-[#111827] hover:bg-[#182234] text-xs text-slate-300 flex items-center justify-center gap-2">
            <UploadCloud className="w-4 h-4" /> {fileName || `Selecionar ${selectedType === "pdf" ? "PDF" : "imagem"}`}
          </button>
          <input value={titleValue} onChange={(event) => setTitleValue(event.target.value)} placeholder="Título opcional" className="w-full h-10 px-3 bg-[#111827] border border-[#334155] text-xs text-slate-200 outline-none focus:border-blue-500" />
          {selectedType === "image" && <textarea value={textValue} onChange={(event) => setTextValue(event.target.value)} placeholder="Contexto opcional da imagem" className="w-full h-20 p-3 bg-[#111827] border border-[#334155] text-xs text-slate-200 outline-none resize-none focus:border-blue-500" />}
        </div>
      );
    }

    if (selectedType === "text") {
      return (
        <div className="space-y-3">
          <input value={titleValue} onChange={(event) => setTitleValue(event.target.value)} placeholder="Título do conhecimento" className="w-full h-10 px-3 bg-[#111827] border border-[#334155] text-xs text-slate-200 outline-none focus:border-blue-500" />
          <textarea value={textValue} onChange={(event) => setTextValue(event.target.value)} placeholder="Cole ou escreva o conteúdo..." className="w-full h-28 p-3 bg-[#111827] border border-[#334155] text-xs text-slate-200 outline-none resize-none focus:border-blue-500" />
        </div>
      );
    }

    return (
      <div className="flex gap-2">
        <input value={textValue} onChange={(event) => setTextValue(event.target.value)} placeholder={selectedType === "youtube" ? "https://youtube.com/watch?v=..." : "https://exemplo.com/artigo"} className="flex-1 h-10 px-3 bg-[#111827] border border-[#334155] text-xs text-slate-200 outline-none focus:border-blue-500" />
        <button type="button" onClick={processSource} disabled={isProcessing} className="w-12 h-10 bg-[#182234] border border-[#334155] text-slate-300 hover:bg-[#26344b] flex items-center justify-center"><Globe className="w-4 h-4" /></button>
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0f131c] text-slate-100 -mx-4 sm:-mx-6 lg:-mx-8 -my-6 md:-my-8 p-6 md:p-7 font-sans">
      <div className="max-w-[1500px] mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-50">Adicionar Conhecimento</h1>
          <p className="text-sm text-slate-500 mt-1">Ingestão e processamento de novas fontes para o cofre Obsidian.</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[440px_minmax(0,1fr)] gap-6 items-stretch min-h-[720px]">
          <div className="flex flex-col gap-6">
            <section className="bg-[#182234] border border-[#334155] rounded-sm p-5">
              <h2 className="text-sm font-semibold flex items-center gap-2"><UploadCloud className="w-4 h-4 text-cyan-400" /> Fonte de Entrada</h2>
              <div className="grid grid-cols-3 gap-2 mt-4">
                {TYPE_OPTIONS.map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" onClick={() => handleTypeChange(id)} className={`min-h-[68px] px-2 py-3 border rounded-sm flex flex-col items-center justify-center gap-2 text-[11px] font-semibold transition-colors ${selectedType === id ? "border-[#b4c5ff] bg-[#1f2d44] text-[#b4c5ff]" : "border-[#334155] bg-[#111827] text-slate-400 hover:bg-[#1c2028] hover:text-slate-200"}`}>
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>
              <div className="mt-4">{renderInput()}</div>
              <button type="button" onClick={processSource} disabled={isProcessing || selectedType === "gdrive"} className="w-full mt-3 h-9 bg-[#2563eb] hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-semibold flex items-center justify-center gap-2">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {isProcessing ? "Processando..." : "Processar Fonte"}
              </button>
              {error && <p className="mt-3 text-xs text-red-300 bg-red-950/30 border border-red-900 p-2">{error}</p>}
            </section>

            <section className="bg-[#182234] border border-[#334155] rounded-sm p-5 flex-1">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-cyan-400" /> Pipeline de Processamento</h2>
                <span className={`text-[10px] font-mono ${isProcessing ? "text-emerald-400" : proposal ? "text-cyan-400" : "text-slate-600"}`}>{isProcessing ? "● Em Processamento" : proposal ? "● Pronto para revisão" : "○ Aguardando"}</span>
              </div>
              <div className="mt-6 space-y-5">
                {pipelineSteps.map((step, index) => {
                  const threshold = [25, 55, 80, 100][index];
                  const done = progress >= threshold || (index === 3 && Boolean(proposal));
                  const active = isProcessing && !done && progress >= Math.max(0, threshold - 30);
                  return (
                    <div key={step.label} className="flex gap-3">
                      <span className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${done ? "border-emerald-600 bg-emerald-950/30 text-emerald-400" : active ? "border-cyan-600 text-cyan-400" : "border-[#334155] text-slate-600"}`}>{done ? <Check className="w-3.5 h-3.5" /> : active ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="text-[9px]">{index + 1}</span>}</span>
                      <div><p className={`text-xs font-semibold ${done || active ? "text-slate-200" : "text-slate-600"}`}>{step.label}</p><p className="text-[11px] text-slate-500 mt-1">{step.detail}</p></div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <section className={`bg-[#182234] border border-[#334155] rounded-sm min-h-[720px] flex flex-col ${proposal ? "border-l-4 border-l-violet-500" : ""}`}>
            <div className="p-5 border-b border-[#334155] flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-violet-300" /> Proposta de Curadoria</h2>
              <span className="text-xs text-slate-500">Revisão humana obrigatória</span>
            </div>

            {!proposal ? (
              <div className="flex-1 flex items-center justify-center text-center p-10">
                <div className="max-w-md"><Sparkles className="w-10 h-10 mx-auto text-slate-700" /><p className="text-sm text-slate-400 mt-4">Processe uma fonte para gerar título, pasta, tags, conexões e resumo. Nada será salvo no Vault sem sua aprovação.</p></div>
              </div>
            ) : (
              <div className="flex-1 p-5 overflow-y-auto space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.1em] font-bold text-slate-500">Título sugerido</span><input value={proposal.title} onChange={(event) => setProposal({ ...proposal, title: event.target.value })} className="w-full h-10 px-3 bg-[#111827] border border-[#334155] text-xs text-slate-100 outline-none focus:border-blue-500" /></label>
                  <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.1em] font-bold text-slate-500">Pasta destino</span><select value={proposal.folder} onChange={(event) => setProposal({ ...proposal, folder: event.target.value })} className="w-full h-10 px-3 bg-[#111827] border border-[#334155] text-xs text-slate-200 outline-none focus:border-blue-500">{STANDARD_VAULT_FOLDERS.map((folder) => <option key={folder}>{folder}</option>)}</select></label>
                </div>

                <div><span className="text-[10px] uppercase tracking-[0.1em] font-bold text-slate-500">Tags identificadas</span><div className="flex flex-wrap gap-2 mt-2">{proposal.keywords.length ? proposal.keywords.map((tag) => <span key={tag} className="px-2.5 py-1 bg-[#263140] border border-[#475569] text-xs font-mono text-slate-200 flex items-center gap-1"><Tag className="w-3 h-3" />#{tag}</span>) : <span className="text-xs text-slate-600">Nenhuma tag identificada.</span>}</div></div>

                <div><span className="text-[10px] uppercase tracking-[0.1em] font-bold text-slate-500">Wikilinks sugeridos (conexões)</span><div className="mt-2 min-h-16 p-3 bg-[#111827] border border-[#334155] text-xs font-mono text-violet-300 space-y-1">{proposal.wikilinks.length ? proposal.wikilinks.map((link) => <div key={link}>[[{link}]]</div>) : <span className="text-slate-600">Nenhuma conexão sugerida.</span>}</div></div>

                <div><span className="text-[10px] uppercase tracking-[0.1em] font-bold text-slate-500">Resumo executivo (extraído)</span><textarea value={proposal.summary} onChange={(event) => setProposal({ ...proposal, summary: event.target.value })} className="mt-2 w-full min-h-28 p-3 bg-[#111827] border border-[#334155] text-xs leading-5 text-slate-200 outline-none resize-y focus:border-blue-500" /></div>

                <div className="grid grid-cols-2 gap-4 text-xs"><div className="bg-[#111827] border border-[#334155] p-3"><span className="text-slate-500">Estado epistemológico</span><div className="mt-2 text-amber-400 font-semibold">{proposal.status}</div></div><div className="bg-[#111827] border border-[#334155] p-3"><span className="text-slate-500">Categoria</span><div className="mt-2 text-slate-200 font-semibold">{proposal.category}</div></div></div>
              </div>
            )}

            <div className="p-4 border-t border-[#334155] flex flex-col sm:flex-row gap-3 justify-end">
              <button type="button" onClick={reset} className="h-10 px-5 border border-[#334155] bg-[#182234] hover:bg-[#263140] text-xs font-semibold text-slate-300 flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> Descartar</button>
              <button type="button" onClick={processSource} disabled={!proposal || isProcessing} className="h-10 px-5 border border-[#334155] bg-[#182234] hover:bg-[#263140] disabled:opacity-40 text-xs font-semibold text-slate-300 flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" /> Reprocessar</button>
              <button type="button" onClick={approveAndSave} disabled={!proposal || !connected || isSaving} className="h-10 px-6 bg-[#2563eb] hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-xs font-semibold text-white flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" /> {isSaving ? "Salvando..." : connected ? "Aprovar e Salvar no Vault" : "Conecte o Obsidian para salvar"}</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
