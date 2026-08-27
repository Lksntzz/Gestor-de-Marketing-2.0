import React, { useEffect, useState } from "react";
import { AlertCircle, FileText, Loader2, X } from "lucide-react";
import type { ObsidianApiConfig, ObsidianNote } from "../types";
import { api } from "../services/api";
import { StorageManager } from "../services/storage/StorageManager";
import { parseMarkdownNote } from "../utils/obsidianUri";

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveNote: (note: ObsidianNote) => void;
  existingFolders: string[];
}

const storage = StorageManager.getInstance();
const DEFAULT_CONFIG: ObsidianApiConfig = {
  endpoint: "http://127.0.0.1:27124",
  apiKey: "",
  geminiApiKey: "",
  vaultName: "MarketingVault",
  useHttps: false,
  autoSync: true,
  syncIntervalSeconds: 60,
  connectionStatus: "disconnected",
  allowSelfSignedCerts: true,
};

export const NoteModal: React.FC<NoteModalProps> = ({ isOpen, onClose, onSaveNote, existingFolders }) => {
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("00_Inbox");
  const [customFolder, setCustomFolder] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (existingFolders.length && !existingFolders.includes(folder)) setFolder(existingFolders[0]);
  }, [isOpen, existingFolders, folder]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!api.isObsidianSessionVerified()) {
      setError("O Obsidian não está conectado. Reconecte antes de criar a nota.");
      return;
    }

    const finalFolder = folder === "OUTRA" ? customFolder.trim() : folder;
    const cleanTitle = title.trim().replace(/[<>:"/\\|?*]/g, "-");
    if (!finalFolder || !cleanTitle || !content.trim()) {
      setError("Informe pasta, título e conteúdo da nota.");
      return;
    }

    const tags = tagsInput.split(",").map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean);
    const date = new Date().toISOString().slice(0, 10);
    const noteId = `note-${Date.now().toString(36)}`;
    const fullContent = `---\nid: "${noteId}"\ntitle: "${cleanTitle.replace(/"/g, "'")}"\nstatus: "NOVO"\nepistemic_status: "PENDENTE"\nowner: "Nisti Marketing"\ncreated_at: "${date}"\nupdated_at: "${date}"\ntags:\n${tags.length ? tags.map((tag) => `  - "${tag.replace(/"/g, "'")}"`).join("\n") : "  - conhecimento"}\n---\n\n${content.trim()}`;
    const parsed = parseMarkdownNote(fullContent);
    const path = `${finalFolder}/${cleanTitle}.md`;
    const config = await storage.loadApiConfig(DEFAULT_CONFIG);

    setIsSaving(true);
    try {
      const write = await api.pushNoteToObsidian(config, path, fullContent, parsed.frontmatter);
      if (!write?.success) throw new Error(write?.message || "O Obsidian não confirmou a gravação.");

      const newNote: ObsidianNote = {
        id: noteId,
        path,
        title: cleanTitle,
        folder: finalFolder,
        content: fullContent,
        frontmatter: parsed.frontmatter,
        tags: Array.from(new Set([...tags, ...parsed.tags])),
        wikilinks: parsed.wikilinks,
        lastModified: new Date().toISOString().replace("T", " ").slice(0, 16),
        syncedWithApi: true,
      };
      onSaveNote(newNote);
      setTitle("");
      setTagsInput("");
      setContent("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Falha ao gravar a nota no Vault.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f131c]/80 backdrop-blur-sm">
      <div className="bg-surface-card rounded-2xl border border-outline-border shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-outline-border flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center"><FileText className="w-4 h-4" /></div>
            <div><h2 className="text-base font-black text-text-primary">Nova nota no Obsidian</h2><p className="text-xs text-text-secondary">Só será adicionada ao Nisti depois da gravação real no Vault.</p></div>
          </div>
          <button onClick={onClose} className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-xs flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
          <div><label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Título</label><input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-border rounded-xl text-xs text-text-primary outline-none" placeholder="Título real da nota" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Pasta do Vault</label><select value={folder} onChange={(e) => setFolder(e.target.value)} className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-border rounded-xl text-xs text-text-primary outline-none">{(existingFolders.length ? existingFolders : ["00_Inbox"]).map((item) => <option key={item} value={item}>{item}</option>)}<option value="OUTRA">+ Nova pasta</option></select></div>
            {folder === "OUTRA" ? <div><label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Nova pasta</label><input required value={customFolder} onChange={(e) => setCustomFolder(e.target.value)} className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-border rounded-xl text-xs text-text-primary outline-none" placeholder="Ex: 07_Pesquisas/Clientes" /></div> : <div><label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Tags</label><input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-border rounded-xl text-xs text-text-primary outline-none" placeholder="marketing, produto" /></div>}
          </div>
          <div><label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Conteúdo Markdown</label><textarea required rows={10} value={content} onChange={(e) => setContent(e.target.value)} className="w-full p-3 bg-surface-container-lowest border border-outline-border rounded-xl text-xs font-mono text-text-primary outline-none resize-none" placeholder="Escreva somente informações reais. O estado inicial será PENDENTE até revisão." /></div>
          <div className="pt-3 border-t border-outline-border flex justify-end gap-2"><button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-text-secondary">Cancelar</button><button type="submit" disabled={isSaving} className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white text-xs font-black rounded-xl disabled:opacity-50 flex items-center gap-2">{isSaving && <Loader2 className="w-4 h-4 animate-spin" />}{isSaving ? "Gravando no Obsidian..." : "Gravar no Obsidian"}</button></div>
        </form>
      </div>
    </div>
  );
};
