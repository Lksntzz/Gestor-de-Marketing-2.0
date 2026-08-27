import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit3,
  ExternalLink,
  FileImage,
  FileText,
  FileType2,
  Folder,
  Loader2,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { ObsidianNote, ObsidianApiConfig } from "../types";
import { buildObsidianOpenUri } from "../utils/obsidianUri";
import { api } from "../services/api";
import { OBSIDIAN_DISCONNECTED_EVENT, OBSIDIAN_SNAPSHOT_EVENT } from "../services/obsidianRuntimeState";

interface VaultViewProps {
  notes: ObsidianNote[];
  selectedNote: ObsidianNote | null;
  onSelectNote: (note: ObsidianNote) => void;
  onUpdateNote: (updatedNote: ObsidianNote) => void;
  onOpenNewNoteModal: () => void;
  onExtractTasksFromNote: (note: ObsidianNote) => void;
  onGenerateCampaignFromNote: (note: ObsidianNote) => void;
  onPushNoteToObsidianApi: (note: ObsidianNote) => void;
  apiConfig: ObsidianApiConfig;
  isExtractingTasks: boolean;
  isPushingToApi: boolean;
}

function cleanMarkdown(value: string): string {
  return (value || "")
    .replace(/^---[\s\S]*?---/m, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/<!--[^>]*-->/g, "")
    .replace(/\[\[|\]\]/g, "")
    .replace(/\*\*|__/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function summaryFor(note: ObsidianNote): string {
  const declared = note.frontmatter?.summary;
  if (typeof declared === "string" && declared.trim()) return declared.trim();
  const text = cleanMarkdown(note.content);
  return text.slice(0, 320) || "Sem resumo disponível para esta fonte.";
}

function importantPoints(note: ObsidianNote): string[] {
  const explicit = note.frontmatter?.key_facts || note.frontmatter?.keyFacts || note.frontmatter?.highlights;
  if (Array.isArray(explicit)) return explicit.map(String).filter(Boolean).slice(0, 5);
  const lines = (note.content || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s+/, "").replace(/^#{1,6}\s+/, "").trim())
    .filter((line) => line.length >= 18 && line.length <= 180 && !line.startsWith("---"));
  return Array.from(new Set(lines)).slice(0, 5);
}

function sourceIcon(note: ObsidianNote) {
  const kind = String(note.frontmatter?.asset_kind || note.frontmatter?.source_type || "markdown").toLowerCase();
  if (kind.includes("image")) return FileImage;
  if (kind.includes("pdf")) return FileType2;
  return FileText;
}

export const VaultView: React.FC<VaultViewProps> = ({
  notes,
  selectedNote,
  onSelectNote,
  onUpdateNote,
  onOpenNewNoteModal,
  onExtractTasksFromNote,
  onGenerateCampaignFromNote,
  apiConfig,
  isExtractingTasks,
}) => {
  const [search, setSearch] = useState("");
  const [vaultFolders, setVaultFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState(false);
  const [editingContent, setEditingContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isConnected = api.isObsidianSessionVerified();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onSnapshot = (event: Event) => {
      const detail = (event as CustomEvent<{ folders?: string[] }>).detail;
      if (Array.isArray(detail?.folders)) setVaultFolders(detail.folders);
    };
    const onDisconnected = () => {
      setVaultFolders([]);
      setError("Obsidian desconectado. O banco de conhecimento está bloqueado.");
      setEditing(false);
    };
    window.addEventListener(OBSIDIAN_SNAPSHOT_EVENT, onSnapshot as EventListener);
    window.addEventListener(OBSIDIAN_DISCONNECTED_EVENT, onDisconnected);
    return () => {
      window.removeEventListener(OBSIDIAN_SNAPSHOT_EVENT, onSnapshot as EventListener);
      window.removeEventListener(OBSIDIAN_DISCONNECTED_EVENT, onDisconnected);
    };
  }, []);

  useEffect(() => {
    if (!isConnected || !window.electronAPI) return;
    void window.electronAPI.listVaultFolders().then((folders) => {
      if (Array.isArray(folders)) setVaultFolders(folders);
    }).catch(() => setVaultFolders([]));
  }, [notes, isConnected]);

  const folders = useMemo(() => {
    const set = new Set(vaultFolders);
    notes.forEach((note) => set.add(note.folder || "00_Inbox"));
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [vaultFolders, notes]);

  const filteredNotes = useMemo(() => {
    const term = search.toLowerCase().trim();
    return notes.filter((note) => {
      const folderMatch = !selectedFolder || note.folder === selectedFolder || note.folder.startsWith(`${selectedFolder}/`);
      const searchMatch = !term || note.title.toLowerCase().includes(term) || cleanMarkdown(note.content).toLowerCase().includes(term);
      return folderMatch && searchMatch;
    });
  }, [notes, selectedFolder, search]);

  const current = selectedNote && filteredNotes.some((n) => n.path === selectedNote.path)
    ? selectedNote
    : filteredNotes[0] || null;
  const points = current ? importantPoints(current) : [];
  const currentSummary = current ? summaryFor(current) : "";
  const CurrentIcon = current ? sourceIcon(current) : FileText;

  const openEdit = () => {
    if (!current || !isConnected) {
      setError("Conecte o Obsidian antes de editar o conhecimento.");
      return;
    }
    if (current.frontmatter?.source_type === "vault_asset") {
      setError("PDFs, imagens e arquivos externos são fontes somente leitura. Edite o arquivo original no Obsidian.");
      return;
    }
    setError(null);
    setEditingContent(current.content);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!current || !isConnected) return;
    setIsSaving(true);
    setError(null);
    try {
      const result = await api.pushNoteToObsidian(apiConfig, current.path, editingContent, current.frontmatter);
      if (!result?.success) throw new Error(result?.message || "O Obsidian não confirmou a gravação.");
      const updated = {
        ...current,
        content: editingContent,
        lastModified: new Date().toISOString().replace("T", " ").slice(0, 16),
        syncedWithApi: true,
      };
      onUpdateNote(updated);
      setEditing(false);
    } catch (err: any) {
      setError(err.message || "Falha ao salvar no Obsidian.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-[calc(100vh-7.5rem)] md:h-[calc(100vh-5rem)] overflow-hidden flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-stone-400"}`} />
            <span className="text-[10px] uppercase tracking-wider font-bold text-stone-500">{isConnected ? "Cofre sincronizado" : "Cofre bloqueado"}</span>
          </div>
          <h1 className="text-xl font-black text-stone-950 mt-0.5">Conhecimento</h1>
        </div>
        <button
          onClick={() => isConnected ? onOpenNewNoteModal() : setError("Conecte o Obsidian antes de criar uma nota.")}
          className="h-9 px-3 rounded-xl bg-stone-900 text-white text-xs font-bold disabled:opacity-40"
          disabled={!isConnected}
        >
          <Plus className="w-3.5 h-3.5 inline mr-1.5" />Nova nota
        </button>
      </div>

      {error && (
        <div className="shrink-0 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-12 gap-3 min-h-0 flex-1">
        <aside className="col-span-12 lg:col-span-3 rounded-2xl bg-white border border-stone-200 overflow-hidden flex flex-col min-h-0">
          <div className="p-3 border-b border-stone-100 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar no cofre..." className="w-full h-9 rounded-xl bg-stone-50 border border-stone-200 pl-8 pr-3 text-xs outline-none focus:border-purple-400" />
            </div>
          </div>
          <div className="overflow-y-auto p-2 flex-1 min-h-0">
            <button onClick={() => setSelectedFolder(null)} className={`w-full h-9 px-2 rounded-lg flex items-center justify-between text-left text-[11px] font-bold ${selectedFolder === null ? "bg-purple-50 text-purple-900" : "hover:bg-stone-50 text-stone-700"}`}>
              <span className="flex items-center gap-2"><Folder className="w-3.5 h-3.5 text-purple-600" />Todo o Vault</span><span className="text-stone-400">{notes.length}</span>
            </button>
            {folders.map((folder) => {
              const depth = folder.split("/").length - 1;
              const count = notes.filter((note) => note.folder === folder || note.folder.startsWith(`${folder}/`)).length;
              const isCollapsed = collapsed[folder];
              return (
                <div key={folder} style={{ paddingLeft: Math.min(depth * 10, 30) }}>
                  <div className={`h-9 rounded-lg flex items-center ${selectedFolder === folder ? "bg-purple-50" : "hover:bg-stone-50"}`}>
                    <button onClick={() => setCollapsed((prev) => ({ ...prev, [folder]: !prev[folder] }))} className="w-6 h-8 flex items-center justify-center text-stone-400">
                      {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    <button onClick={() => setSelectedFolder(folder)} className={`min-w-0 flex-1 text-left text-[11px] font-semibold truncate ${selectedFolder === folder ? "text-purple-900" : "text-stone-700"}`} title={folder}>
                      {folder.split("/").pop()}
                    </button>
                    <span className="text-[9px] text-stone-400 pr-2">{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <section className="col-span-12 lg:col-span-4 rounded-2xl bg-white border border-stone-200 overflow-hidden flex flex-col min-h-0">
          <div className="h-12 px-4 border-b border-stone-100 flex items-center justify-between shrink-0">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Arquivos</div>
              <div className="text-[10px] text-stone-400">{filteredNotes.length} itens</div>
            </div>
          </div>
          <div className="overflow-y-auto p-2 flex-1 min-h-0 space-y-1">
            {filteredNotes.map((note) => {
              const Icon = sourceIcon(note);
              const active = current?.path === note.path;
              return (
                <button key={note.path} onClick={() => { onSelectNote(note); setEditing(false); setError(null); }} className={`w-full min-h-14 rounded-xl px-3 py-2.5 flex items-start gap-2.5 text-left border ${active ? "bg-purple-50 border-purple-200" : "bg-white border-transparent hover:border-stone-200 hover:bg-stone-50"}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${active ? "bg-white text-purple-700" : "bg-stone-100 text-stone-500"}`}><Icon className="w-3.5 h-3.5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-stone-900 truncate">{note.title}</div>
                    <div className="text-[10px] text-stone-500 line-clamp-2 mt-0.5">{summaryFor(note)}</div>
                  </div>
                </button>
              );
            })}
            {!filteredNotes.length && <div className="h-32 flex items-center justify-center text-xs text-stone-500 text-center p-4">Nenhum arquivo nesta seleção.</div>}
          </div>
        </section>

        <section className="col-span-12 lg:col-span-5 rounded-2xl bg-white border border-stone-200 overflow-hidden flex flex-col min-h-0">
          {current ? (
            <>
              <div className="px-4 py-3 border-b border-stone-100 flex items-start justify-between gap-3 shrink-0">
                <div className="min-w-0 flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0"><CurrentIcon className="w-4 h-4 text-purple-700" /></div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-stone-950 truncate">{current.title}</h2>
                    <div className="text-[10px] text-stone-500 truncate mt-0.5">{current.path}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { navigator.clipboard.writeText(current.content); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center" title="Copiar"><Copy className="w-3.5 h-3.5 text-stone-500" /></button>
                  {current.frontmatter?.source_type !== "vault_asset" && <button onClick={openEdit} className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center" title="Editar"><Edit3 className="w-3.5 h-3.5 text-stone-500" /></button>}
                  <a href={buildObsidianOpenUri(apiConfig.vaultName, current.path)} className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center" title="Abrir no Obsidian"><ExternalLink className="w-3.5 h-3.5 text-stone-500" /></a>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 min-h-0 p-4 space-y-4">
                {editing ? (
                  <div className="h-full min-h-[360px] flex flex-col gap-3">
                    <textarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} className="flex-1 min-h-[300px] rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs font-mono outline-none focus:border-purple-400" />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditing(false)} className="h-9 px-3 rounded-xl border border-stone-200 text-xs font-bold">Cancelar</button>
                      <button onClick={saveEdit} disabled={isSaving} className="h-9 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">{isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : <Check className="w-3.5 h-3.5 inline mr-1" />}Salvar no Obsidian</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl bg-stone-50 border border-stone-100 p-4">
                      <div className="text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-2">Resumo inteligente</div>
                      <p className="text-xs leading-relaxed text-stone-700">{currentSummary}</p>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-2">Pontos importantes</div>
                      {points.length ? <div className="space-y-2">{points.map((point, index) => <div key={`${point}-${index}`} className="flex items-start gap-2 text-xs text-stone-700"><span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" /><span>{point}</span></div>)}</div> : <p className="text-xs text-stone-500">Ainda não há pontos estruturados para esta fonte.</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-stone-200 p-3">
                        <div className="text-[9px] uppercase font-bold text-stone-400">Estado</div>
                        <div className="text-[11px] font-bold text-stone-800 mt-1">{String(current.frontmatter?.epistemic_status || current.frontmatter?.status || "PENDENTE")}</div>
                      </div>
                      <div className="rounded-xl border border-stone-200 p-3">
                        <div className="text-[9px] uppercase font-bold text-stone-400">Origem</div>
                        <div className="text-[11px] font-bold text-stone-800 mt-1 truncate">{String(current.frontmatter?.source_type || current.frontmatter?.origem || "Markdown")}</div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-stone-100 flex flex-wrap gap-2">
                      <button onClick={() => onGenerateCampaignFromNote(current)} className="h-9 px-3 rounded-xl bg-purple-700 text-white text-xs font-bold"><Sparkles className="w-3.5 h-3.5 inline mr-1.5" />Usar no marketing</button>
                      <button onClick={() => onExtractTasksFromNote(current)} disabled={isExtractingTasks} className="h-9 px-3 rounded-xl border border-stone-200 text-xs font-bold disabled:opacity-50">Extrair tarefas</button>
                    </div>
                    {copied && <div className="text-[10px] text-emerald-700 font-bold">Conteúdo copiado.</div>}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-center p-8">
              <div>
                <FileText className="w-7 h-7 text-stone-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-stone-700">Selecione uma fonte</p>
                <p className="text-xs text-stone-500 mt-1">O sistema mostra apenas a síntese; o contexto completo permanece no Obsidian.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
