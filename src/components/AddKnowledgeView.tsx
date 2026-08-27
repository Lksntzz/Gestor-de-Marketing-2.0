import React, { useMemo, useState } from "react";
import {
  AlignLeft,
  AlertCircle,
  Check,
  CheckCircle2,
  Cloud,
  ExternalLink,
  FileText,
  FolderOpen,
  Globe,
  Image as ImageIcon,
  Link2,
  Loader2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Youtube,
} from "lucide-react";
import type { EngineMode, KnowledgeStatus, ObsidianApiConfig, ObsidianNote } from "../types";
import { STANDARD_VAULT_FOLDERS } from "../data/defaultVault";
import { api } from "../services/api";
import { googleDriveService } from "../services/googleDriveService";
import { buildObsidianOpenUri } from "../utils/obsidianUri";
import { GoogleDriveSelector } from "./GoogleDriveSelector";

interface AddKnowledgeViewProps {
  notes: ObsidianNote[];
  onAddNote: (newNote: ObsidianNote) => void;
  apiConfig: ObsidianApiConfig;
  onNavigateTab: (tab: "dashboard" | "vault" | "campaigns" | "tasks" | "automations" | "routine") => void;
  onSelectNote: (note: ObsidianNote) => void;
  engineMode: EngineMode;
}

type KnowledgeType = "pdf" | "image" | "youtube" | "site" | "text" | "gdrive";
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
}

const TYPE_LABELS: Record<KnowledgeType, string> = {
  site: "URL Web",
  pdf: "PDF",
  youtube: "YouTube",
  image: "Imagem / OCR",
  text: "Texto Livre",
  gdrive: "Google Drive",
};

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

export const AddKnowledgeView: React.FC<AddKnowledgeViewProps> = ({
  notes,
  onAddNote,
  apiConfig,
  onNavigateTab,
  onSelectNote,
  engineMode,
}) => {
  const [selectedType, setSelectedType] = useState<KnowledgeType>("text");
  const [pdfFileName, setPdfFileName] = useState("");
  const [pdfBase64, setPdfBase64] = useState("");
  const [imageTitle, setImageTitle] = useState("");
  const [imageBase64, setImageBase64] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [siteTitle, setSiteTitle] = useState("");
  const [rawTextTitle, setRawTextTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<CurationProposal | null>(null);
  const [createdNote, setCreatedNote] = useState<ObsidianNote | null>(null);

  const isConnected = api.isObsidianSessionVerified();
  const driveConnected = googleDriveService.isAuthenticated();

  const sourceDescription = useMemo(() => {
    if (selectedType === "youtube") {
      return "O link é tratado como referência. Só considere conteúdo do vídeo como analisado quando houver texto/transcrição efetivamente disponível.";
    }
    if (selectedType === "pdf") return "O PDF é enviado ao processador autenticado para extração e síntese.";
    if (selectedType === "image") return "A imagem é enviada para análise visual/OCR quando o Gemini estiver ativo.";
    return "A fonte será sintetizada e ficará pendente de revisão antes de ser gravada no Vault.";
  }, [selectedType]);

  const resetResult = () => {
    setError(null);
    setProposal(null);
    setCreatedNote(null);
  };

  const readAsDataUrl = (file: File, onDone: (value: string) => void) => {
    const reader = new FileReader();
    reader.onloadend = () => onDone(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  };

  const buildPayload = (): Record<string, unknown> => {
    if (selectedType === "pdf") return { fileName: pdfFileName, base64: pdfBase64 };
    if (selectedType === "image") return { title: imageTitle, imageBase64 };
    if (selectedType === "youtube") return { url: youtubeUrl, videoTitle: youtubeTitle };
    if (selectedType === "site") return { url: siteUrl, pageTitle: siteTitle };
    return { title: rawTextTitle, text: rawText };
  };

  const validate = (): string | null => {
    if (!isConnected) return "Conecte e valide o Obsidian antes de processar conhecimento.";
    if (selectedType === "pdf" && (!pdfFileName || !pdfBase64)) return "Selecione um arquivo PDF.";
    if (selectedType === "image" && !imageBase64) return "Selecione uma imagem.";
    if (selectedType === "youtube" && !youtubeUrl.trim()) return "Informe o link do YouTube.";
    if (selectedType === "site" && !siteUrl.trim()) return "Informe a URL do site.";
    if (selectedType === "text" && (!rawTextTitle.trim() || !rawText.trim())) return "Informe título e conteúdo do texto.";
    if (selectedType === "gdrive") return "Selecione um arquivo do Google Drive para continuar.";
    return null;
  };

  const handleProcess = async () => {
    resetResult();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsProcessing(true);
    try {
      const payload = buildPayload();
      const result = await api.processKnowledge(selectedType, payload, engineMode);
      if (!result?.success || !result?.data) throw new Error(result?.error || "O processador não retornou uma proposta válida.");

      const data = result.data as Record<string, unknown>;
      const suggestedFolder = typeof data.folder === "string" ? data.folder : "00_Inbox";
      const folder = STANDARD_VAULT_FOLDERS.includes(suggestedFolder) ? suggestedFolder : "00_Inbox";
      const title = sanitizeTitle(String(data.title || rawTextTitle || imageTitle || pdfFileName.replace(/\.pdf$/i, "") || siteTitle || youtubeTitle || "Novo Conhecimento"));
      const summary = String(data.summary || "").trim();
      const evidence = cleanStringArray(data.evidence || data.keyFacts || data.keyTakeaways);
      const hypotheses = cleanStringArray(data.marketingHypotheses || data.hypotheses || data.suggestedAngles);
      const keywords = cleanStringArray(data.keywords || data.tags);
      const wikilinks = cleanStringArray(data.wikilinks);
      const epistemicStatus = safeEpistemicStatus(data.epistemic_status || data.epistemicStatus);
      const content = String(data.content || "").trim() || [
        `# ${title}`,
        "",
        summary ? `## Resumo\n${summary}` : "",
        evidence.length ? `## Evidências\n${evidence.map((item) => `- ${item}`).join("\n")}` : "",
        hypotheses.length ? `## Hipóteses\n${hypotheses.map((item) => `- ${item}`).join("\n")}` : "",
      ].filter(Boolean).join("\n\n");

      setProposal({
        title,
        folder,
        status: folder === "00_Inbox" ? "NOVO" : "EM REVISÃO",
        epistemicStatus,
        tipo: selectedType === "pdf" ? "Documento PDF" : selectedType === "image" ? "Ativo Visual" : selectedType === "youtube" ? "Referência YouTube" : selectedType === "site" ? "Artigo Web" : "Texto",
        category: String(data.category || "Conhecimento"),
        keywords,
        wikilinks,
        content,
        summary,
        evidence,
        hypotheses,
        sourceUrl: selectedType === "site" ? siteUrl : selectedType === "youtube" ? youtubeUrl : undefined,
        fileName: selectedType === "pdf" ? pdfFileName : undefined,
      });
    } catch (err: any) {
      setError(err.message || "Falha ao processar a fonte.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async (forceInbox = false) => {
    if (!proposal) return;
    if (!api.isObsidianSessionVerified()) {
      setError("A conexão com o Obsidian foi perdida. Reconecte antes de salvar.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const folder = forceInbox ? "00_Inbox" : proposal.folder;
      const status: KnowledgeStatus = forceInbox ? "NOVO" : proposal.status;
      const now = new Date();
      const timestamp = now.toISOString().replace("T", " ").slice(0, 16);
      const date = now.toISOString().slice(0, 10);
      const noteId = `knowledge-${now.getTime().toString(36)}`;
      const notePath = `${folder}/${sanitizeTitle(proposal.title)}.md`;
      const tags = proposal.keywords;
      const frontmatter = {
        id: noteId,
        tipo: proposal.tipo,
        status,
        epistemic_status: proposal.epistemicStatus,
        category: proposal.category,
        owner: "Nisti Marketing",
        created_at: date,
        updated_at: date,
        tags,
        origem: proposal.fileName || proposal.sourceUrl || "Nisti Marketing",
        approved_by: status === "OFICIAL" ? "Revisão humana" : "",
      };

      const frontmatterText = [
        "---",
        `id: "${noteId}"`,
        `tipo: "${proposal.tipo}"`,
        `status: "${status}"`,
        `epistemic_status: "${proposal.epistemicStatus}"`,
        `category: "${proposal.category.replace(/"/g, "'")}"`,
        `owner: "Nisti Marketing"`,
        `created_at: "${date}"`,
        `updated_at: "${date}"`,
        "tags:",
        ...(tags.length ? tags.map((tag) => `  - "${tag.replace(/"/g, "'")}"`) : ["  - conhecimento"]),
        `origem: "${String(frontmatter.origem).replace(/"/g, "'")}"`,
        "---",
        "",
      ].join("\n");
      const finalContent = proposal.content.trimStart().startsWith("---") ? proposal.content : `${frontmatterText}${proposal.content}`;

      const writeResult = await api.pushNoteToObsidian(apiConfig, notePath, finalContent, frontmatter);
      if (!writeResult?.success) throw new Error(writeResult?.message || "O Obsidian não confirmou a gravação.");

      const newNote: ObsidianNote = {
        id: noteId,
        path: notePath,
        title: proposal.title,
        folder,
        content: finalContent,
        frontmatter,
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

  const handleDriveFile = (fileData: { name: string; contentText: string; base64?: string; isPdf?: boolean; mimeType: string }) => {
    resetResult();
    if (fileData.isPdf || fileData.name.toLowerCase().endsWith(".pdf")) {
      setSelectedType("pdf");
      setPdfFileName(fileData.name);
      setPdfBase64(fileData.base64 || "");
      return;
    }
    if (fileData.mimeType.startsWith("image/")) {
      setSelectedType("image");
      setImageTitle(fileData.name.replace(/\.[^/.]+$/, ""));
      setImageBase64(fileData.base64 || "");
      return;
    }
    setSelectedType("text");
    setRawTextTitle(fileData.name.replace(/\.[^/.]+$/, ""));
    setRawText(fileData.contentText || "");
  };

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-4 font-sans">
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-outline-border shrink-0">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-pink-500">
            <ShieldCheck className="w-3.5 h-3.5" />
            Ingestão autenticada
          </div>
          <h1 className="text-2xl font-black text-text-primary mt-1">Adicionar Conhecimento</h1>
          <p className="text-xs text-text-secondary mt-1">A IA propõe. Você revisa. O estado local só muda depois que o Obsidian confirma a gravação.</p>
        </div>
        <div className={`px-3 py-2 rounded-xl border text-xs font-bold ${isConnected ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
          {isConnected ? `Obsidian conectado • ${notes.length} itens` : "Obsidian bloqueado"}
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
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-text-primary mb-4">Fonte</h2>
          <div className="grid grid-cols-3 gap-2 mb-5">
            {(["site", "pdf", "youtube", "image", "text", "gdrive"] as KnowledgeType[]).map((type) => {
              const Icon = type === "site" ? Globe : type === "pdf" ? FileText : type === "youtube" ? Youtube : type === "image" ? ImageIcon : type === "gdrive" ? Cloud : AlignLeft;
              return (
                <button key={type} type="button" onClick={() => { setSelectedType(type); resetResult(); }} className={`p-3 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-2 ${selectedType === type ? "border-pink-500 bg-pink-500/10 text-pink-200" : "border-outline-border bg-surface-container-low text-text-secondary hover:text-text-primary"}`}>
                  <Icon className="w-4 h-4" />
                  {TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-text-secondary mb-4 leading-relaxed">{sourceDescription}</p>

          {selectedType === "pdf" && (
            <label className="block border border-dashed border-outline-border rounded-xl p-5 text-center cursor-pointer hover:border-pink-500/60">
              <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setPdfFileName(file.name);
                readAsDataUrl(file, setPdfBase64);
                resetResult();
              }} />
              <UploadCloud className="w-6 h-6 mx-auto text-pink-400 mb-2" />
              <span className="text-xs font-bold text-text-primary">{pdfFileName || "Selecionar PDF"}</span>
            </label>
          )}

          {selectedType === "image" && (
            <div className="space-y-3">
              <label className="block border border-dashed border-outline-border rounded-xl p-5 text-center cursor-pointer hover:border-pink-500/60">
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setImageTitle(file.name.replace(/\.[^/.]+$/, ""));
                  readAsDataUrl(file, setImageBase64);
                  resetResult();
                }} />
                <UploadCloud className="w-6 h-6 mx-auto text-pink-400 mb-2" />
                <span className="text-xs font-bold text-text-primary">{imageTitle || "Selecionar imagem"}</span>
              </label>
              {imageBase64 && <img src={imageBase64} alt="Prévia" className="max-h-32 mx-auto rounded-lg object-contain" />}
            </div>
          )}

          {selectedType === "youtube" && (
            <div className="space-y-2">
              <input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="w-full bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none" />
              <input value={youtubeTitle} onChange={(e) => setYoutubeTitle(e.target.value)} placeholder="Título opcional" className="w-full bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none" />
            </div>
          )}

          {selectedType === "site" && (
            <div className="space-y-2">
              <input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://..." className="w-full bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none" />
              <input value={siteTitle} onChange={(e) => setSiteTitle(e.target.value)} placeholder="Título opcional" className="w-full bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none" />
            </div>
          )}

          {selectedType === "text" && (
            <div className="space-y-2">
              <input value={rawTextTitle} onChange={(e) => setRawTextTitle(e.target.value)} placeholder="Título" className="w-full bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none" />
              <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} placeholder="Cole o conteúdo real aqui..." className="w-full h-36 bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none resize-none" />
            </div>
          )}

          {selectedType === "gdrive" && (
            driveConnected ? <GoogleDriveSelector onSelectFile={handleDriveFile} onCancel={() => setSelectedType("text")} /> : <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs">Conecte o Google Drive nas Configurações.</div>
          )}

          {selectedType !== "gdrive" && (
            <button type="button" disabled={isProcessing || !isConnected} onClick={handleProcess} className="mt-5 w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white text-xs font-black flex items-center justify-center gap-2">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isProcessing ? "Analisando fonte..." : "Processar para revisão"}
            </button>
          )}
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
              <div className="flex gap-2 mt-5">
                <button onClick={() => { onSelectNote(createdNote); onNavigateTab("vault"); }} className="px-4 py-2 rounded-xl bg-surface-container-low border border-outline-border text-xs font-bold text-text-primary">Ver no Cofre</button>
                <a href={buildObsidianOpenUri(apiConfig.vaultName, createdNote.path)} className="px-4 py-2 rounded-xl bg-pink-600 text-white text-xs font-bold flex items-center gap-1.5">Abrir no Obsidian <ExternalLink className="w-3.5 h-3.5" /></a>
              </div>
            </div>
          ) : proposal ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-pink-400 font-bold">Proposta para revisão humana</span>
                  <h2 className="text-xl font-black text-text-primary mt-1">{proposal.title}</h2>
                </div>
                <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-black ${proposal.epistemicStatus === "CONFIRMADO" ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10" : proposal.epistemicStatus === "HIPÓTESE" ? "border-amber-500/30 text-amber-300 bg-amber-500/10" : "border-slate-500/30 text-slate-300 bg-slate-500/10"}`}>{proposal.epistemicStatus}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-surface-container-low border border-outline-border"><span className="text-text-secondary block text-[10px] uppercase">Pasta sugerida</span><strong className="text-text-primary flex items-center gap-1 mt-1"><FolderOpen className="w-3.5 h-3.5" />{proposal.folder}</strong></div>
                <div className="p-3 rounded-xl bg-surface-container-low border border-outline-border"><span className="text-text-secondary block text-[10px] uppercase">Categoria</span><strong className="text-text-primary mt-1 block">{proposal.category}</strong></div>
              </div>

              {proposal.summary && <div><h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">Resumo</h3><p className="text-sm leading-relaxed text-text-primary">{proposal.summary}</p></div>}
              {proposal.evidence.length > 0 && <div><h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">Evidências extraídas</h3><ul className="space-y-2">{proposal.evidence.map((item, index) => <li key={index} className="text-xs text-text-primary flex gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />{item}</li>)}</ul></div>}
              {proposal.hypotheses.length > 0 && <div><h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">Hipóteses</h3><ul className="space-y-2">{proposal.hypotheses.map((item, index) => <li key={index} className="text-xs text-text-primary">• {item}</li>)}</ul></div>}
              {proposal.wikilinks.length > 0 && <div className="flex flex-wrap gap-2">{proposal.wikilinks.map((link) => <span key={link} className="px-2 py-1 rounded-lg bg-primary-container/10 border border-primary-container/20 text-[10px] text-primary-fixed-dim flex items-center gap-1"><Link2 className="w-3 h-3" />[[{link}]]</span>)}</div>}

              <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-outline-border">
                <button onClick={() => setProposal(null)} className="px-4 py-2 rounded-xl bg-surface-container-low border border-outline-border text-xs font-bold text-text-primary">Descartar</button>
                <button disabled={isSaving} onClick={() => handleSave(true)} className="px-4 py-2 rounded-xl bg-surface-container-low border border-outline-border text-xs font-bold text-text-primary disabled:opacity-50">Salvar em 00_Inbox</button>
                <button disabled={isSaving} onClick={() => handleSave(false)} className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black flex items-center gap-2 disabled:opacity-50">{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}Aprovar e gravar no Obsidian</button>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-64 flex flex-col items-center justify-center text-center">
              <FileText className="w-10 h-10 text-text-secondary/40 mb-3" />
              <h3 className="font-bold text-text-primary">Aguardando uma fonte real</h3>
              <p className="text-xs text-text-secondary max-w-md mt-1">O sistema não cria exemplos automáticos nem afirmações comerciais sem evidência. Depois da análise, você revisa antes de gravar.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
