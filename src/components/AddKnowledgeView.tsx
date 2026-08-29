import React, { useEffect, useMemo, useState } from "react";
import {
  AlignLeft,
  AlertCircle,
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  FolderOpen,
  Link2,
  Loader2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import type { EngineMode, KnowledgeStatus, ObsidianApiConfig, ObsidianNote } from "../types";
import { api } from "../services/api";
import { buildObsidianOpenUri } from "../utils/obsidianUri";
import {
  detectKnowledgeFileType,
  detectKnowledgeLinkType,
  isSupportedKnowledgeLink,
  type KnowledgeProcessorType,
  type PrimaryKnowledgeSource,
} from "../utils/knowledgeSourceInput";

interface AddKnowledgeViewProps {
  notes: ObsidianNote[];
  onAddNote: (newNote: ObsidianNote) => void;
  apiConfig: ObsidianApiConfig;
  onNavigateTab: (tab: "dashboard" | "vault" | "campaigns" | "tasks" | "automations" | "routine") => void;
  onSelectNote: (note: ObsidianNote) => void;
  engineMode: EngineMode;
}

type EpistemicStatus = "CONFIRMADO" | "HIPÓTESE" | "PENDENTE";

interface CurationProposal {
  title: string;
  folder: string;
  status: KnowledgeStatus;
  epistemicStatus: EpistemicStatus;
  tipo: string;
  category: string;
  keywords: string[];
  wikilinks: string[];
  content: string;
  summary: string;
  evidence: string[];
  hypotheses: string[];
  sourceUrl?: string;
  fileName?: string;
  analysisModel: string;
  wasFallback: boolean;
}

const MAX_MANUAL_SOURCE_BYTES = 15 * 1024 * 1024;

function safeEpistemicStatus(value: unknown): EpistemicStatus {
  return value === "CONFIRMADO" || value === "HIPÓTESE" || value === "PENDENTE" ? value : "PENDENTE";
}

function cleanStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 12)
    : [];
}

function sanitizeTitle(value: string): string {
  return value.replace(/[<>:"/\\|?*]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "Novo Conhecimento";
}

function stripLeadingFrontmatter(value: string): string {
  return String(value || "")
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
    .replace(/^#\s+[^\r\n]+\r?\n+/, "")
    .trim();
}

function chooseLiveFolder(suggestedFolder: string, liveFolders: string[]): string {
  const folders = Array.from(new Set(liveFolders.filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  if (folders.includes(suggestedFolder)) return suggestedFolder;
  if (folders.includes("00_Inbox")) return "00_Inbox";
  return folders[0] || "00_Inbox";
}

export const AddKnowledgeView: React.FC<AddKnowledgeViewProps> = ({
  notes,
  onAddNote,
  apiConfig,
  onNavigateTab,
  onSelectNote,
  engineMode,
}) => {
  const [sourceMode, setSourceMode] = useState<PrimaryKnowledgeSource>("text");
  const [binaryType, setBinaryType] = useState<"pdf" | "image" | null>(null);
  const [binaryFileName, setBinaryFileName] = useState("");
  const [binaryDataUrl, setBinaryDataUrl] = useState("");
  const [binaryTitle, setBinaryTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [rawTextTitle, setRawTextTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [vaultFolders, setVaultFolders] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<CurationProposal | null>(null);
  const [createdNote, setCreatedNote] = useState<ObsidianNote | null>(null);

  const isConnected = api.isObsidianSessionVerified();
  const processorType: KnowledgeProcessorType =
    sourceMode === "file"
      ? binaryType || "pdf"
      : sourceMode === "link"
        ? detectKnowledgeLinkType(linkUrl)
        : "text";

  useEffect(() => {
    let active = true;
    if (!isConnected || !window.electronAPI?.listVaultFolders) {
      setVaultFolders([]);
      return () => { active = false; };
    }

    void window.electronAPI.listVaultFolders()
      .then((folders) => {
        if (!active) return;
        setVaultFolders(Array.isArray(folders) ? folders.filter(Boolean) : []);
      })
      .catch((err) => {
        if (!active) return;
        setVaultFolders([]);
        setError(err?.message || "Não foi possível carregar as pastas reais do Vault.");
      });

    return () => { active = false; };
  }, [isConnected, notes.length]);

  const sourceDescription = useMemo(() => {
    if (sourceMode === "file") {
      if (binaryType === "pdf") return "PDF detectado. O original será preservado junto da síntese após sua aprovação.";
      if (binaryType === "image") return "Imagem detectada. A análise visual e o arquivo original serão preservados após sua aprovação.";
      return "Selecione um PDF, PNG, JPG/JPEG ou WEBP. O Nisti identifica o tipo automaticamente.";
    }
    if (sourceMode === "link") {
      if (linkUrl && processorType === "youtube") {
        return "YouTube detectado automaticamente. O link é tratado como referência e só vira evidência quando houver conteúdo realmente analisável.";
      }
      return "Cole um link de site ou YouTube. O Nisti escolhe o processador correto automaticamente.";
    }
    return "Cole uma informação real. O Nisti sintetiza e mantém a revisão humana antes de gravar no Vault.";
  }, [sourceMode, binaryType, linkUrl, processorType]);

  const resetResult = () => {
    setError(null);
    setProposal(null);
    setCreatedNote(null);
  };

  const changeSourceMode = (mode: PrimaryKnowledgeSource) => {
    setSourceMode(mode);
    resetResult();
  };

  const readAsDataUrl = (file: File, onDone: (value: string) => void) => {
    if (file.size > MAX_MANUAL_SOURCE_BYTES) {
      setError("O arquivo excede 15 MB. Reduza o arquivo antes de enviar para análise e preservação no Vault.");
      onDone("");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => onDone(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => setError("Não foi possível ler o arquivo selecionado.");
    reader.readAsDataURL(file);
  };

  const handleFileSelected = (file: File) => {
    const detectedType = detectKnowledgeFileType({ name: file.name, mimeType: file.type });
    resetResult();
    setSourceMode("file");
    setBinaryDataUrl("");

    if (!detectedType) {
      setBinaryType(null);
      setBinaryFileName("");
      setBinaryTitle("");
      setError("Formato não suportado. Use PDF, PNG, JPG/JPEG ou WEBP.");
      return;
    }

    setBinaryType(detectedType);
    setBinaryFileName(file.name);
    setBinaryTitle(file.name.replace(/\.[^/.]+$/, ""));
    readAsDataUrl(file, setBinaryDataUrl);
  };

  const handleLinkChange = (value: string) => {
    setLinkUrl(value);
    setError(null);
    setProposal(null);
    setCreatedNote(null);
  };

  const buildPayload = (type: KnowledgeProcessorType): Record<string, unknown> => {
    if (type === "pdf") return { fileName: binaryFileName, base64: binaryDataUrl };
    if (type === "image") return { title: binaryTitle, imageBase64: binaryDataUrl };
    if (type === "youtube") return { url: linkUrl, videoTitle: linkTitle };
    if (type === "site") return { url: linkUrl, pageTitle: linkTitle };
    return { title: rawTextTitle, text: rawText };
  };

  const validate = (): string | null => {
    if (!isConnected) return "Conecte e valide o Obsidian antes de processar conhecimento.";

    if (sourceMode === "file") {
      if (!binaryType || !binaryFileName || !binaryDataUrl) {
        return "Selecione um PDF ou uma imagem suportada antes de continuar.";
      }
      return null;
    }

    if (sourceMode === "link") {
      if (!linkUrl.trim()) return "Informe o link da fonte.";
      if (!isSupportedKnowledgeLink(linkUrl)) return "Use um link HTTP ou HTTPS válido.";
      return null;
    }

    if (!rawTextTitle.trim() || !rawText.trim()) return "Informe título e conteúdo do texto.";
    return null;
  };

  const fallbackTitleFor = (type: KnowledgeProcessorType): string => {
    if (type === "pdf") return binaryFileName.replace(/\.pdf$/i, "");
    if (type === "image") return binaryTitle;
    if (type === "youtube" || type === "site") return linkTitle;
    return rawTextTitle;
  };

  const handleProcess = async () => {
    resetResult();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const type = processorType;
    setIsProcessing(true);
    try {
      const result = await api.processKnowledge(type, buildPayload(type), engineMode);
      if (!result?.success || !result?.data) throw new Error(result?.error || "O processador não retornou uma proposta válida.");

      const data = result.data as Record<string, unknown>;
      const suggestedFolder = typeof data.folder === "string" ? data.folder : "00_Inbox";
      const folder = chooseLiveFolder(suggestedFolder, vaultFolders);
      const title = sanitizeTitle(String(data.title || fallbackTitleFor(type) || "Novo Conhecimento"));
      const summary = String(data.summary || "").trim();
      const evidence = cleanStringArray(data.evidence || data.keyFacts || data.keyTakeaways);
      const hypotheses = cleanStringArray(data.marketingHypotheses || data.hypotheses || data.suggestedAngles);
      const keywords = cleanStringArray(data.keywords || data.tags);
      const wikilinks = cleanStringArray(data.wikilinks);
      const epistemicStatus = safeEpistemicStatus(data.epistemic_status || data.epistemicStatus);
      const content = String(data.content || "").trim();

      setProposal({
        title,
        folder,
        status: folder === "00_Inbox" ? "NOVO" : "EM REVISÃO",
        epistemicStatus,
        tipo: type === "pdf" ? "Documento PDF" : type === "image" ? "Ativo Visual" : type === "youtube" ? "Referência YouTube" : type === "site" ? "Artigo Web" : "Texto",
        category: String(data.category || "Não classificado"),
        keywords,
        wikilinks,
        content,
        summary,
        evidence,
        hypotheses,
        sourceUrl: sourceMode === "link" ? linkUrl : undefined,
        fileName: sourceMode === "file" ? binaryFileName : undefined,
        analysisModel: String(result.usedModel || "não informado"),
        wasFallback: Boolean(result.wasFallback),
      });
    } catch (err: any) {
      setError(err.message || "Falha ao processar a fonte.");
    } finally {
      setIsProcessing(false);
    }
  };

  const buildCuratedContent = (current: CurationProposal) => {
    const processed = stripLeadingFrontmatter(current.content);
    return [
      `# ${current.title}`,
      current.summary ? `## Resumo inteligente\n${current.summary}` : "",
      current.evidence.length ? `## Pontos importantes\n${current.evidence.map((item) => `- ${item}`).join("\n")}` : "",
      current.hypotheses.length ? `## Hipóteses\n${current.hypotheses.map((item) => `- ${item}`).join("\n")}` : "",
      processed ? `## Conteúdo processado\n${processed}` : "",
      `## Rastreabilidade da análise\n- Motor/modelo: ${current.analysisModel}\n- Fallback seguro: ${current.wasFallback ? "sim" : "não"}\n- Estado epistemológico: ${current.epistemicStatus}`,
    ].filter(Boolean).join("\n\n");
  };

  const handleSave = async (forceInbox = false) => {
    if (!proposal) return;
    if (!api.isObsidianSessionVerified()) {
      setError("A conexão com o Obsidian foi perdida. Reconecte antes de salvar.");
      return;
    }

    const folder = forceInbox ? "00_Inbox" : proposal.folder;
    if (window.electronAPI && !vaultFolders.includes(folder)) {
      setError("A pasta selecionada não existe mais no Vault. Sincronize o Cofre e selecione uma pasta real.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const now = new Date();
      const timestamp = now.toISOString().replace("T", " ").slice(0, 16);
      const date = now.toISOString().slice(0, 10);
      const noteId = `knowledge-${now.getTime().toString(36)}`;
      const status: KnowledgeStatus = folder === "00_Inbox" ? "NOVO" : "EM REVISÃO";
      const tags = proposal.keywords;
      const baseFrontmatter: Record<string, unknown> = {
        id: noteId,
        tipo: proposal.tipo,
        status,
        epistemic_status: proposal.epistemicStatus,
        category: proposal.category,
        owner: "Nisti Marketing",
        created_at: date,
        updated_at: date,
        summary: proposal.summary || undefined,
        key_facts: proposal.evidence.length ? proposal.evidence : undefined,
        tags: tags.length ? tags : undefined,
        origem: proposal.fileName || proposal.sourceUrl || "Entrada manual no Nisti Marketing",
        source_url: proposal.sourceUrl || undefined,
        analysis_model: proposal.analysisModel,
        analysis_fallback: proposal.wasFallback ? "true" : "false",
      };
      const curatedContent = buildCuratedContent(proposal);
      const isBinarySource = processorType === "pdf" || processorType === "image";
      const dataUrl = isBinarySource ? binaryDataUrl : "";

      let noteTitle = proposal.title;
      let notePath = `${folder}/${sanitizeTitle(proposal.title)}.md`;
      let committedFrontmatter = { ...baseFrontmatter };

      if (window.electronAPI?.commitKnowledge) {
        const commitResult = await window.electronAPI.commitKnowledge({
          folder,
          title: sanitizeTitle(proposal.title),
          content: curatedContent,
          frontmatter: baseFrontmatter,
          asset: isBinarySource && proposal.fileName && dataUrl
            ? { fileName: proposal.fileName, dataUrl }
            : undefined,
        });
        if (!commitResult?.success || !commitResult.noteRelativePath) {
          throw new Error(commitResult?.error || "O Obsidian não confirmou o commit transacional do conhecimento.");
        }

        noteTitle = commitResult.noteTitle || proposal.title;
        notePath = commitResult.noteRelativePath;
        if (commitResult.assetRelativePath) {
          committedFrontmatter = {
            ...committedFrontmatter,
            source_type: "curated_asset",
            asset_kind: processorType === "pdf" ? "pdf" : "image",
            asset_path: commitResult.assetRelativePath,
            asset_mtime: String(commitResult.assetMtimeMs || ""),
            asset_size: String(commitResult.assetSize || ""),
            origem: commitResult.assetRelativePath,
          };
        }

        try {
          await api.syncObsidianSnapshot();
        } catch (syncError) {
          console.warn("Knowledge was committed, but the immediate Vault refresh failed:", syncError);
        }
      } else {
        if (isBinarySource) {
          throw new Error("A preservação do arquivo original exige o runtime desktop. A gravação foi bloqueada para não criar uma síntese sem a fonte física.");
        }
        const writeResult = await api.pushNoteToObsidian(apiConfig, notePath, curatedContent, baseFrontmatter);
        if (!writeResult?.success) throw new Error(writeResult?.message || "O Obsidian não confirmou a gravação.");
      }

      const newNote: ObsidianNote = {
        id: noteId,
        path: notePath,
        title: noteTitle,
        folder,
        content: curatedContent,
        frontmatter: committedFrontmatter,
        tags,
        wikilinks: proposal.wikilinks,
        lastModified: timestamp,
        syncedWithApi: true,
      };
      onAddNote(newNote);
      onSelectNote(newNote);
      setCreatedNote(newNote);
      setProposal(null);
    } catch (err: any) {
      setError(err.message || "Falha ao gravar no Vault.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-4 font-sans">
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-outline-border shrink-0">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-pink-500">
            <ShieldCheck className="w-3.5 h-3.5" />
            Fonte revisada antes de entrar na Base
          </div>
          <h1 className="text-2xl font-black text-text-primary mt-1">Adicionar fonte</h1>
          <p className="text-xs text-text-secondary mt-1">Escolha o que você tem. O Nisti identifica o formato técnico, prepara a síntese e só grava depois da sua revisão.</p>
        </div>
        <div className={`px-3 py-2 rounded-xl border text-xs font-bold ${isConnected ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
          {isConnected ? `Base conectada • ${vaultFolders.length} pastas` : "Base bloqueada"}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-xs flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        <section className="lg:col-span-5 bg-surface-card border border-outline-border rounded-xl p-5 overflow-y-auto no-scrollbar">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-text-primary mb-4">Como você quer adicionar?</h2>

          <div className="grid grid-cols-3 gap-2 mb-5">
            {(["file", "link", "text"] as PrimaryKnowledgeSource[]).map((mode) => {
              const Icon = mode === "file" ? UploadCloud : mode === "link" ? Link2 : AlignLeft;
              const label = mode === "file" ? "Arquivo" : mode === "link" ? "Link" : "Texto";
              const hint = mode === "file" ? "PDF ou imagem" : mode === "link" ? "Site ou YouTube" : "Digitar ou colar";
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => changeSourceMode(mode)}
                  className={`p-3 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1.5 ${
                    sourceMode === mode
                      ? "border-pink-500 bg-pink-500/10 text-pink-200"
                      : "border-outline-border bg-surface-container-low text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <Icon className="w-4 h-4 mb-0.5" />
                  <span>{label}</span>
                  <span className="text-[9px] font-medium opacity-70">{hint}</span>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-text-secondary mb-4 leading-relaxed">{sourceDescription}</p>

          {sourceMode === "file" && (
            <div className="space-y-3">
              <label className="block border border-dashed border-outline-border rounded-xl p-5 text-center cursor-pointer hover:border-pink-500/60">
                <input
                  type="file"
                  accept="application/pdf,.pdf,image/png,.png,image/jpeg,.jpg,.jpeg,image/webp,.webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleFileSelected(file);
                  }}
                />
                <UploadCloud className="w-6 h-6 mx-auto text-pink-400 mb-2" />
                <span className="text-xs font-bold text-text-primary">{binaryFileName || "Selecionar arquivo"}</span>
                <span className="block text-[10px] text-text-secondary mt-1">PDF, PNG, JPG/JPEG ou WEBP • máximo 15 MB</span>
              </label>

              {binaryFileName && binaryType && (
                <div className="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-border text-[10px] text-text-secondary flex items-center justify-between gap-2">
                  <span className="truncate">{binaryFileName}</span>
                  <span className="font-black text-text-primary shrink-0">{binaryType === "pdf" ? "PDF detectado" : "Imagem detectada"}</span>
                </div>
              )}

              {binaryType === "image" && binaryDataUrl && (
                <img src={binaryDataUrl} alt="Prévia da fonte" className="max-h-40 mx-auto rounded-lg object-contain" />
              )}
            </div>
          )}

          {sourceMode === "link" && (
            <div className="space-y-2">
              <input
                value={linkUrl}
                onChange={(event) => handleLinkChange(event.target.value)}
                placeholder="https://..."
                className="w-full bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none"
              />
              <input
                value={linkTitle}
                onChange={(event) => { setLinkTitle(event.target.value); setProposal(null); setCreatedNote(null); }}
                placeholder="Título opcional"
                className="w-full bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none"
              />
              {linkUrl.trim() && isSupportedKnowledgeLink(linkUrl) && (
                <div className="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-border text-[10px] text-text-secondary flex items-center justify-between gap-2">
                  <span>Tipo identificado automaticamente</span>
                  <span className="font-black text-text-primary">{processorType === "youtube" ? "YouTube" : "Site"}</span>
                </div>
              )}
            </div>
          )}

          {sourceMode === "text" && (
            <div className="space-y-2">
              <input
                value={rawTextTitle}
                onChange={(event) => { setRawTextTitle(event.target.value); setProposal(null); setCreatedNote(null); }}
                placeholder="Título"
                className="w-full bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none"
              />
              <textarea
                value={rawText}
                onChange={(event) => { setRawText(event.target.value); setProposal(null); setCreatedNote(null); }}
                placeholder="Digite ou cole a informação real aqui..."
                className="w-full h-40 bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none resize-none"
              />
            </div>
          )}

          <button
            type="button"
            disabled={isProcessing || !isConnected}
            onClick={handleProcess}
            className="mt-5 w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white text-xs font-black flex items-center justify-center gap-2"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isProcessing ? "Analisando fonte..." : "Analisar para revisão"}
          </button>
        </section>

        <section className="lg:col-span-7 bg-surface-card border border-outline-border rounded-xl p-5 overflow-y-auto no-scrollbar">
          {isProcessing ? (
            <div className="h-full min-h-64 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 animate-spin text-pink-500 mb-3" />
              <h3 className="font-bold text-text-primary">Extraindo e classificando evidências</h3>
              <p className="text-xs text-text-secondary mt-1">Nenhuma gravação acontece nesta etapa.</p>
            </div>
          ) : createdNote ? (
            <div className="h-full min-h-64 flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-3" />
              <h3 className="text-lg font-black text-text-primary">Gravação confirmada pelo Obsidian</h3>
              <p className="text-xs text-text-secondary mt-2 font-mono">{createdNote.path}</p>
              {createdNote.frontmatter.asset_path && <p className="text-[11px] text-emerald-300 mt-2">Fonte original preservada: {createdNote.frontmatter.asset_path}</p>}
              <div className="flex gap-2 mt-5">
                <button onClick={() => { onSelectNote(createdNote); onNavigateTab("vault"); }} className="px-4 py-2 rounded-xl bg-surface-container-low border border-outline-border text-xs font-bold text-text-primary">Ver na Base</button>
                <a href={buildObsidianOpenUri(apiConfig.vaultName, createdNote.path)} className="px-4 py-2 rounded-xl bg-pink-600 text-white text-xs font-bold flex items-center gap-1.5">Abrir no Obsidian <ExternalLink className="w-3.5 h-3.5" /></a>
              </div>
            </div>
          ) : proposal ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-pink-400 font-bold">Proposta para revisão humana</span>
                  <h2 className="text-xl font-black text-text-primary mt-1">{proposal.title}</h2>
                  <p className="text-[10px] text-text-secondary mt-1">{proposal.wasFallback ? "Fallback seguro" : "Análise processada"} • {proposal.analysisModel}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-black ${proposal.epistemicStatus === "CONFIRMADO" ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10" : proposal.epistemicStatus === "HIPÓTESE" ? "border-amber-500/30 text-amber-300 bg-amber-500/10" : "border-slate-500/30 text-slate-300 bg-slate-500/10"}`}>{proposal.epistemicStatus}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <label className="p-3 rounded-xl bg-surface-container-low border border-outline-border">
                  <span className="text-text-secondary block text-[10px] uppercase mb-1">Pasta real do Obsidian</span>
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-3.5 h-3.5 text-text-secondary" />
                    <select value={proposal.folder} onChange={(event) => {
                      const folder = event.target.value;
                      setProposal((current) => current ? { ...current, folder, status: folder === "00_Inbox" ? "NOVO" : "EM REVISÃO" } : current);
                    }} className="w-full bg-transparent text-text-primary text-xs outline-none">
                      {vaultFolders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}
                    </select>
                  </div>
                </label>
                <div className="p-3 rounded-xl bg-surface-container-low border border-outline-border"><span className="text-text-secondary block text-[10px] uppercase">Categoria</span><strong className="text-text-primary mt-1 block">{proposal.category}</strong></div>
              </div>

              {proposal.fileName && <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-200"><strong>Fonte física:</strong> {proposal.fileName}. Ela será preservada somente quando você aprovar a gravação.</div>}
              {proposal.summary && <div><h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">Resumo</h3><p className="text-sm leading-relaxed text-text-primary">{proposal.summary}</p></div>}
              {proposal.evidence.length > 0 && <div><h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">Evidências extraídas</h3><ul className="space-y-2">{proposal.evidence.map((item, index) => <li key={index} className="text-xs text-text-primary flex gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />{item}</li>)}</ul></div>}
              {proposal.hypotheses.length > 0 && <div><h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">Hipóteses</h3><ul className="space-y-2">{proposal.hypotheses.map((item, index) => <li key={index} className="text-xs text-text-primary">• {item}</li>)}</ul></div>}
              {proposal.wikilinks.length > 0 && <div className="flex flex-wrap gap-2">{proposal.wikilinks.map((link) => <span key={link} className="px-2 py-1 rounded-lg bg-primary-container/10 border border-primary-container/20 text-[10px] text-primary-fixed-dim flex items-center gap-1"><Link2 className="w-3 h-3" />[[{link}]]</span>)}</div>}

              <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-outline-border">
                <button onClick={() => setProposal(null)} className="px-4 py-2 rounded-xl bg-surface-container-low border border-outline-border text-xs font-bold text-text-primary">Descartar</button>
                {vaultFolders.includes("00_Inbox") && proposal.folder !== "00_Inbox" && <button disabled={isSaving} onClick={() => handleSave(true)} className="px-4 py-2 rounded-xl bg-surface-container-low border border-outline-border text-xs font-bold text-text-primary disabled:opacity-50">Salvar em 00_Inbox</button>}
                <button disabled={isSaving || vaultFolders.length === 0} onClick={() => handleSave(false)} className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black flex items-center gap-2 disabled:opacity-50">{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}Aprovar e gravar no Obsidian</button>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-64 flex flex-col items-center justify-center text-center">
              <FileText className="w-10 h-10 text-text-secondary/40 mb-3" />
              <h3 className="font-bold text-text-primary">Aguardando uma fonte real</h3>
              <p className="text-xs text-text-secondary max-w-md mt-1">Escolha Arquivo, Link ou Texto. O Nisti não grava nada antes de você revisar a proposta.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
