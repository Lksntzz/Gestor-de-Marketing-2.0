import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  FolderOpen,
  FileText,
  Search,
  Plus,
  ExternalLink,
  Sparkles,
  Link2,
  Edit3,
  ChevronDown,
  ChevronRight,
  Check,
  SlidersHorizontal,
  Copy,
  FileCode,
  Folder,
  Loader2,
} from "lucide-react";
import { ObsidianNote, ObsidianApiConfig } from "../types";
import { buildObsidianOpenUri } from "../utils/obsidianUri";
import { api } from "../services/api";
import {
  OBSIDIAN_DISCONNECTED_EVENT,
  OBSIDIAN_SNAPSHOT_EVENT,
} from "../services/obsidianRuntimeState";
import confetti from "canvas-confetti";

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

export const VaultView: React.FC<VaultViewProps> = ({
  notes,
  selectedNote,
  onSelectNote,
  onUpdateNote,
  onOpenNewNoteModal,
  onExtractTasksFromNote,
  onGenerateCampaignFromNote,
  onPushNoteToObsidianApi: _onPushNoteToObsidianApi,
  apiConfig,
  isExtractingTasks,
  isPushingToApi: _isPushingToApi,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");
  const [editingContent, setEditingContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [vaultFolders, setVaultFolders] = useState<string[]>([]);
  const [isAdvancedMetaOpen, setIsAdvancedMetaOpen] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleSnapshot = (event: Event) => {
      const detail = (event as CustomEvent<{ folders?: string[] }>).detail;
      if (Array.isArray(detail?.folders)) {
        setVaultFolders(detail.folders);
      }
    };
    const handleDisconnected = () => {
      setVaultFolders([]);
      setSaveError("Obsidian desconectado. O banco de conhecimento foi bloqueado até uma nova conexão.");
      setIsEditing(false);
      setViewMode("preview");
    };

    window.addEventListener(OBSIDIAN_SNAPSHOT_EVENT, handleSnapshot as EventListener);
    window.addEventListener(OBSIDIAN_DISCONNECTED_EVENT, handleDisconnected);
    return () => {
      window.removeEventListener(OBSIDIAN_SNAPSHOT_EVENT, handleSnapshot as EventListener);
      window.removeEventListener(OBSIDIAN_DISCONNECTED_EVENT, handleDisconnected);
    };
  }, []);

  useEffect(() => {
    if (!api.isObsidianSessionVerified() || !window.electronAPI) return;
    void window.electronAPI
      .listVaultFolders()
      .then((folders) => setVaultFolders(Array.isArray(folders) ? folders : []))
      .catch(() => setVaultFolders([]));
  }, [notes]);

  const toggleFolder = (folderName: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName],
    }));
  };

  const folders = useMemo(() => {
    const map = new Map<string, ObsidianNote[]>();
    vaultFolders.forEach((folderName) => map.set(folderName, []));
    notes.forEach((note) => {
      const f = note.folder || "00_Inbox";
      if (!map.has(f)) map.set(f, []);
      map.get(f)!.push(note);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [notes, vaultFolders]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((n) => (n.tags || []).forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const term = (searchTerm || "").toLowerCase().trim();
    return notes.filter((n) => {
      const matchSearch =
        !term ||
        (n.title || "").toLowerCase().includes(term) ||
        (n.content || "").toLowerCase().includes(term);
      const matchTag = selectedTag ? (n.tags || []).includes(selectedTag) : true;
      const matchStatus = statusFilter ? n.frontmatter?.status === statusFilter : true;
      return matchSearch && matchTag && matchStatus;
    });
  }, [notes, searchTerm, selectedTag, statusFilter]);

  const currentNote = selectedNote || notes[0] || null;

  const backlinks = useMemo(() => {
    if (!currentNote || !currentNote.title) return [];
    const targetTitle = currentNote.title.toLowerCase();
    return notes.filter(
      (n) => n.id !== currentNote.id && (n.wikilinks || []).some((w) => (w || "").toLowerCase() === targetTitle)
    );
  }, [notes, currentNote]);

  const requireLiveObsidian = (): boolean => {
    if (api.isObsidianSessionVerified()) return true;
    setSaveError("Obsidian desconectado. Conecte e sincronize o Vault antes de acessar ou alterar o banco de conhecimento.");
    return false;
  };

  const handleStartEdit = () => {
    if (!requireLiveObsidian()) return;
    if (currentNote) {
      setSaveError(null);
      setEditingContent(currentNote.content);
      setIsEditing(true);
      setViewMode("edit");
    }
  };

  const handleSaveEdit = async () => {
    if (!currentNote || !requireLiveObsidian()) return;

    const updatedNote: ObsidianNote = {
      ...currentNote,
      content: editingContent,
      lastModified: new Date().toISOString().replace("T", " ").slice(0, 16),
      syncedWithApi: true,
    };

    setIsSavingEdit(true);
    setSaveError(null);
    try {
      const result = await api.pushNoteToObsidian(
        apiConfig,
        currentNote.path,
        editingContent,
        currentNote.frontmatter
      );
      if (!result?.success) {
        setSaveError(result?.message || "O Obsidian não confirmou a gravação. Alterações descartadas.");
        return;
      }

      onUpdateNote(updatedNote);
      setIsEditing(false);
      setViewMode("preview");
      setSaveFeedback(true);
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
      setTimeout(() => setSaveFeedback(false), 2000);
    } catch (err: any) {
      setSaveError(err.message || "Falha ao salvar alterações no Obsidian.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCopyMarkdown = () => {
    if (currentNote) {
      navigator.clipboard.writeText(currentNote.content);
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 1800);
    }
  };

  const handleNewNote = () => {
    if (!requireLiveObsidian()) return;
    onOpenNewNoteModal();
  };

  const isConnected = api.isObsidianSessionVerified();

  return (
    <div className="w-full px-4 md:px-8 lg:px-12 space-y-6 pb-16 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200 uppercase tracking-wider">
              {notes.length} Documentos Markdown
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${isConnected ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-red-700 bg-red-50 border-red-200"}`}>
              {isConnected ? `${folders.length} pastas sincronizadas` : "Obsidian desconectado"}
            </span>
          </div>
          <h1 className="text-xl font-black text-stone-900 tracking-tight mt-1">
            Conhecimento (Cofre PKM)
          </h1>
          <p className="text-xs text-stone-500">
            O Obsidian é a fonte de verdade. Sem conexão ativa, leitura e gravação ficam bloqueadas.
          </p>
        </div>

        <button
          onClick={handleNewNote}
          disabled={!isConnected}
          className="px-4 py-2 bg-stone-900 hover:bg-stone-850 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 self-start sm:self-center cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-purple-400" />
          <span>+ Nova Nota</span>
        </button>
      </div>

      {saveError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{saveError}</span>
        </div>
      )}

      {saveFeedback && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <Check className="w-4 h-4" /> Alterações confirmadas no Vault do Obsidian.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-3xs space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar notas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={!isConnected}
                className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200/80 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-purple-500 disabled:opacity-50"
              />
            </div>

            <div className="flex items-center gap-1 pt-0.5">
              <button
                onClick={() => setStatusFilter(null)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${statusFilter === null ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
              >
                Todos
              </button>
              <button
                onClick={() => setStatusFilter(statusFilter === "OFICIAL" ? null : "OFICIAL")}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${statusFilter === "OFICIAL" ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-800 border border-emerald-200/60 hover:bg-emerald-100"}`}
              >
                OFICIAL
              </button>
              <button
                onClick={() => setStatusFilter(statusFilter === "EM REVISÃO" ? null : "EM REVISÃO")}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${statusFilter === "EM REVISÃO" ? "bg-amber-700 text-white" : "bg-amber-50 text-amber-800 border border-amber-200/60 hover:bg-amber-100"}`}
              >
                EM REVISÃO
              </button>
              <button
                onClick={() => setStatusFilter(statusFilter === "NOVO" ? null : "NOVO")}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${statusFilter === "NOVO" ? "bg-blue-700 text-white" : "bg-blue-50 text-blue-800 border border-blue-200/60 hover:bg-blue-100"}`}
              >
                NOVO
              </button>
            </div>

            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1 max-h-20 overflow-y-auto border-t border-stone-100">
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all cursor-pointer ${selectedTag === null ? "bg-purple-700 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
                >
                  Todas as tags
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-all cursor-pointer ${selectedTag === tag ? "bg-purple-700 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-3xs p-3 space-y-3 max-h-[620px] overflow-y-auto">
            {!isConnected && (
              <div className="p-4 text-center text-xs text-stone-500 border border-dashed border-stone-300 rounded-xl">
                Conecte o Obsidian para carregar as pastas e o banco de conhecimento.
              </div>
            )}
            {isConnected && folders.map(([folderName, folderNotes]) => {
              const isCollapsed = collapsedFolders[folderName];
              const visibleFolderNotes = folderNotes.filter((n) => filteredNotes.some((fn) => fn.id === n.id));

              if (visibleFolderNotes.length === 0 && folderNotes.length > 0 && (searchTerm || selectedTag || statusFilter)) {
                return null;
              }

              return (
                <div key={folderName} className="space-y-1">
                  <button
                    onClick={() => toggleFolder(folderName)}
                    className="w-full flex items-center justify-between p-1.5 text-stone-700 hover:bg-stone-50 rounded-lg text-left text-xs font-bold transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-1.5">
                      {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-stone-400" /> : <ChevronDown className="w-3.5 h-3.5 text-stone-400" />}
                      <Folder className="w-3.5 h-3.5 text-purple-600" />
                      <span className="truncate">{folderName}</span>
                    </div>
                    <span className="text-[10px] font-mono text-stone-400 group-hover:text-stone-700">{folderNotes.length}</span>
                  </button>

                  {!isCollapsed && (
                    <div className="pl-4 space-y-0.5 border-l border-stone-150 ml-2">
                      {visibleFolderNotes.length === 0 ? (
                        <div className="p-2 text-[10px] text-stone-400 italic">Pasta vazia</div>
                      ) : visibleFolderNotes.map((note) => {
                        const isSelected = currentNote?.id === note.id;
                        return (
                          <button
                            key={note.id}
                            onClick={() => {
                              onSelectNote(note);
                              setIsEditing(false);
                              setViewMode("preview");
                              setSaveError(null);
                            }}
                            className={`w-full text-left p-2 rounded-xl text-xs transition-all flex items-center justify-between gap-2 cursor-pointer ${isSelected ? "bg-purple-50 text-purple-900 font-bold border border-purple-200/80 shadow-3xs" : "text-stone-700 hover:bg-stone-50 hover:text-stone-900"}`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <FileText className={`w-3 h-3 shrink-0 ${isSelected ? "text-purple-600" : "text-stone-400"}`} />
                              <span className="truncate">{note.title}</span>
                            </div>
                            {note.tags && note.tags.length > 0 && <span className="text-[9px] text-stone-400 shrink-0">#{note.tags[0]}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
          {isConnected && currentNote ? (
            <div className="bg-white rounded-3xl border border-stone-200/80 shadow-3xs overflow-hidden">
              <div className="p-5 sm:px-7 border-b border-stone-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/40">
                <div>
                  <div className="flex items-center gap-2 text-[11px] text-stone-400">
                    <span className="font-mono">{currentNote.folder || "00_Inbox"}</span>
                    <span>•</span>
                    <span>Modificado {currentNote.lastModified}</span>
                  </div>
                  <div className="flex items-center gap-2.5 mt-0.5">
                    <h2 className="text-lg font-black text-stone-900 tracking-tight">{currentNote.title}</h2>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentNote.frontmatter?.status === "OFICIAL" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : currentNote.frontmatter?.status === "EM REVISÃO" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-blue-50 text-blue-800 border-blue-200"}`}>
                      {currentNote.frontmatter?.status || "OFICIAL"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-start sm:self-center">
                  <button
                    onClick={() => viewMode === "preview" ? handleStartEdit() : void handleSaveEdit()}
                    disabled={isSavingEdit}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 ${viewMode === "edit" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-white hover:bg-stone-100 text-stone-700 border border-stone-200"}`}
                  >
                    {isSavingEdit ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Salvando...</span></> : viewMode === "edit" ? <><Check className="w-3.5 h-3.5" /><span>Salvar</span></> : <><Edit3 className="w-3.5 h-3.5 text-stone-500" /><span>Editar</span></>}
                  </button>

                  <button onClick={handleCopyMarkdown} className="p-2 bg-white hover:bg-stone-100 text-stone-600 rounded-xl border border-stone-200 transition-all cursor-pointer" title="Copiar Markdown">
                    {copiedMarkdown ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>

                  <a href={buildObsidianOpenUri(apiConfig.vaultName, currentNote.path)} className="p-2 bg-white hover:bg-stone-100 text-stone-600 rounded-xl border border-stone-200 transition-all" title="Abrir no app Obsidian">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    onClick={() => setIsAdvancedMetaOpen(!isAdvancedMetaOpen)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${isAdvancedMetaOpen ? "bg-purple-100 text-purple-900 border border-purple-300" : "bg-white hover:bg-stone-100 text-stone-600 border border-stone-200"}`}
                    title="Alternar painel de metadados, backlinks e YAML avançado"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Modo Avançado</span>
                  </button>
                </div>
              </div>

              {isAdvancedMetaOpen && (
                <div className="bg-stone-50 border-b border-stone-200 p-5 space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Metadados & Conexões Atômicas (Modo Avançado)</span>
                    <span className="text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded font-mono">{currentNote.path}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="bg-white p-3.5 rounded-xl border border-stone-200 space-y-2">
                      <span className="text-[10px] font-bold text-stone-500 uppercase flex items-center gap-1">
                        <FileCode className="w-3 h-3 text-purple-600" /> <span>Frontmatter YAML</span>
                      </span>
                      <div className="font-mono text-[11px] text-stone-700 bg-stone-50 p-2 rounded-lg space-y-1">
                        {currentNote.frontmatter && Object.keys(currentNote.frontmatter).length > 0 ? Object.entries(currentNote.frontmatter).map(([k, v]) => (
                          <div key={k}><span className="text-purple-700">{k}:</span> {String(v)}</div>
                        )) : <span className="text-stone-400">Nenhum YAML declarado</span>}
                      </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-stone-200 space-y-2">
                      <span className="text-[10px] font-bold text-stone-500 uppercase flex items-center gap-1">
                        <Link2 className="w-3 h-3 text-purple-600" /> <span>Backlinks ({backlinks.length})</span>
                      </span>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {backlinks.length > 0 ? backlinks.map((b) => (
                          <button key={b.id} onClick={() => onSelectNote(b)} className="text-left w-full text-xs text-purple-700 hover:underline flex items-center gap-1 font-mono">[[{b.title}]]</button>
                        )) : <span className="text-stone-400 text-[11px]">Nenhuma nota aponta para cá</span>}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <button onClick={() => onGenerateCampaignFromNote(currentNote)} className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs">
                      <Sparkles className="w-3.5 h-3.5 text-purple-300" /> <span>Gerar Campanha com esta Nota</span>
                    </button>
                    <button onClick={() => onExtractTasksFromNote(currentNote)} disabled={isExtractingTasks} className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-800 text-xs font-bold rounded-xl border border-stone-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                      <Check className="w-3.5 h-3.5 text-stone-500" /> <span>{isExtractingTasks ? "Extraindo..." : "Extrair Tarefas para Centro"}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="p-6 sm:p-8">
                {viewMode === "edit" ? (
                  <div className="space-y-3">
                    <textarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} className="w-full h-[450px] p-4 bg-stone-50 border border-stone-200 rounded-2xl font-mono text-xs text-stone-900 leading-relaxed focus:outline-none focus:border-purple-500" />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setIsEditing(false); setViewMode("preview"); }} className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl">Cancelar</button>
                      <button onClick={() => void handleSaveEdit()} disabled={isSavingEdit} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-3xs flex items-center gap-2">
                        {isSavingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Salvar Alterações
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-stone max-w-none text-stone-800 text-sm leading-relaxed font-sans space-y-4">
                    {(currentNote.content || "").split("\n\n").map((paragraph, index) => {
                      if (!paragraph) return null;
                      if (paragraph.startsWith("# ")) return <h1 key={index} className="text-xl font-black text-stone-900 pt-2 pb-1 border-b border-stone-150">{paragraph.replace("# ", "")}</h1>;
                      if (paragraph.startsWith("## ")) return <h2 key={index} className="text-base font-bold text-stone-900 pt-2">{paragraph.replace("## ", "")}</h2>;
                      if (paragraph.startsWith("### ")) return <h3 key={index} className="text-sm font-bold text-stone-800">{paragraph.replace("### ", "")}</h3>;
                      if (paragraph.includes("\n- ") || paragraph.startsWith("- ")) {
                        const items = paragraph.split("\n- ").map((item) => (item || "").replace(/^- /, ""));
                        return <ul key={index} className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-stone-700">{items.map((it, i) => <li key={i}>{it}</li>)}</ul>;
                      }
                      if (paragraph.startsWith("> ")) return <blockquote key={index} className="border-l-4 border-purple-500 pl-4 py-1 italic text-stone-600 bg-purple-50/40 rounded-r-xl text-xs sm:text-sm">{paragraph.replace(/^> /gm, "")}</blockquote>;
                      return <p key={index} className="text-xs sm:text-sm text-stone-700 leading-relaxed">{paragraph}</p>;
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 bg-white rounded-3xl border border-stone-200/80 text-center space-y-4 shadow-3xs">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 mx-auto flex items-center justify-center border border-purple-100">
                <FolderOpen className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-base font-bold text-stone-800">{isConnected ? "Cofre sincronizado" : "Banco de conhecimento bloqueado"}</h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  {isConnected ? "Nenhuma nota selecionada. Escolha uma nota na árvore ou crie uma nova diretamente no Vault." : "Conecte o Obsidian nas configurações. Somente depois da validação o Nisti Marketing carrega as pastas e libera leitura e gravação."}
                </p>
              </div>
              {isConnected && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button onClick={handleNewNote} className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs">
                    <Plus className="w-3.5 h-3.5" /> <span>Criar Primeira Nota</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
