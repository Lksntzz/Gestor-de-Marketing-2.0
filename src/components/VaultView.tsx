import React, { useMemo, useState } from "react";
import {
  CheckSquare,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  Link2,
  Pencil,
  Save,
  Search,
  Tag,
} from "lucide-react";
import { ObsidianNote, ObsidianApiConfig } from "../types";
import { buildObsidianOpenUri } from "../utils/obsidianUri";

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

const STATUS_OPTIONS = ["OFICIAL", "EM REVISÃO", "NOVO"] as const;

function renderMarkdownPreview(content: string) {
  const lines = (content || "").split(/\r?\n/);
  return lines.map((line, index) => {
    if (line.startsWith("### ")) {
      return <h3 key={index} className="text-lg font-semibold text-slate-100 mt-6 mb-2">{line.slice(4)}</h3>;
    }
    if (line.startsWith("## ")) {
      return <h2 key={index} className="text-2xl font-semibold text-slate-100 mt-8 mb-3 pb-2 border-b border-[#334155]">{line.slice(3)}</h2>;
    }
    if (line.startsWith("# ")) {
      return <h1 key={index} className="text-3xl font-bold text-slate-50 mt-2 mb-5">{line.slice(2)}</h1>;
    }
    if (/^- \[[ xX]\]/.test(line)) {
      const done = /^- \[[xX]\]/.test(line);
      return (
        <div key={index} className="my-2 px-4 py-3 bg-[#182234] border border-[#334155] border-l-4 border-l-[#2563eb] flex items-start gap-3">
          <span className={`mt-0.5 w-4 h-4 border flex items-center justify-center text-[10px] ${done ? "bg-blue-500 border-blue-500 text-white" : "border-slate-500"}`}>{done ? "✓" : ""}</span>
          <span className={`text-sm ${done ? "line-through text-slate-500" : "text-slate-300"}`}>{line.replace(/^- \[[ xX]\]\s*/, "")}</span>
        </div>
      );
    }
    if (/^```/.test(line)) {
      return <div key={index} className="h-px bg-[#334155] my-3" />;
    }
    if (!line.trim()) return <div key={index} className="h-3" />;
    return <p key={index} className="text-sm leading-6 text-slate-300">{line}</p>;
  });
}

export const VaultView: React.FC<VaultViewProps> = ({
  notes,
  selectedNote,
  onSelectNote,
  onUpdateNote,
  onOpenNewNoteModal,
  onExtractTasksFromNote,
  onGenerateCampaignFromNote: _onGenerateCampaignFromNote,
  onPushNoteToObsidianApi,
  apiConfig,
  isExtractingTasks,
  isPushingToApi,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingContent, setEditingContent] = useState("");
  const connected = apiConfig.connectionStatus === "connected";

  const filteredNotes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return notes.filter((note) => {
      const matchesText = !term || note.title.toLowerCase().includes(term) || note.path.toLowerCase().includes(term) || note.content.toLowerCase().includes(term);
      const matchesStatus = !statusFilter || String(note.frontmatter?.status || "").toUpperCase() === statusFilter;
      return matchesText && matchesStatus;
    });
  }, [notes, searchTerm, statusFilter]);

  const currentNote = selectedNote || filteredNotes[0] || notes[0] || null;

  const folders = useMemo(() => {
    const map = new Map<string, ObsidianNote[]>();
    filteredNotes.forEach((note) => {
      const folder = note.folder || "00_Inbox";
      const bucket = map.get(folder) || [];
      bucket.push(note);
      map.set(folder, bucket);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredNotes]);

  const backlinks = useMemo(() => {
    if (!currentNote) return [];
    const target = currentNote.title.toLowerCase();
    return notes.filter((note) => note.id !== currentNote.id && (note.wikilinks || []).some((link) => link.toLowerCase() === target));
  }, [notes, currentNote]);

  const startEditing = () => {
    if (!currentNote || !connected) return;
    setEditingContent(currentNote.content);
    setIsEditing(true);
  };

  const saveEditing = () => {
    if (!currentNote || !connected) return;
    const updated: ObsidianNote = {
      ...currentNote,
      content: editingContent,
      lastModified: new Date().toISOString(),
    };
    onUpdateNote(updated);
    onPushNoteToObsidianApi(updated);
    setIsEditing(false);
  };

  const openInObsidian = () => {
    if (!currentNote || !connected) return;
    window.location.href = buildObsidianOpenUri(apiConfig.vaultName, currentNote.path);
  };

  return (
    <div className="h-[calc(100vh-4rem)] bg-[#0f131c] text-slate-100 -mx-4 sm:-mx-6 lg:-mx-8 -my-6 md:-my-8 font-sans overflow-hidden">
      <div className="h-full grid grid-cols-1 lg:grid-cols-[276px_minmax(0,1fr)_292px]">
        <aside className="hidden lg:flex bg-[#1c2028] border-r border-[#334155] flex-col min-h-0">
          <div className="p-3 border-b border-[#334155] space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Filtrar arquivos..."
                className="w-full h-8 pl-9 pr-3 bg-[#111827] border border-[#475569] rounded-sm text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => setStatusFilter(null)} className={`px-2 py-1 text-[10px] font-bold border rounded-sm ${!statusFilter ? "bg-slate-600 text-white border-slate-500" : "text-slate-400 border-[#334155]"}`}>Todos</button>
              {STATUS_OPTIONS.map((status) => (
                <button key={status} onClick={() => setStatusFilter(statusFilter === status ? null : status)} className={`px-2 py-1 text-[10px] font-bold border rounded-sm ${statusFilter === status ? "bg-[#182234] text-blue-300 border-blue-500" : status === "OFICIAL" ? "text-emerald-400 border-emerald-700" : status === "EM REVISÃO" ? "text-amber-400 border-amber-700" : "text-blue-300 border-[#475569]"}`}>{status}</button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {folders.length === 0 ? (
              <div className="p-4 text-xs text-slate-500 text-center">Nenhuma nota sincronizada.</div>
            ) : folders.map(([folder, folderNotes]) => {
              const depth = Math.max(0, folder.split(/[\\/]/).length - 1);
              return (
                <div key={folder} className="mb-3" style={{ paddingLeft: `${Math.min(depth, 3) * 8}px` }}>
                  <div className="flex items-center gap-2 h-7 text-xs text-slate-400">
                    <Folder className="w-4 h-4" />
                    <span className="truncate">{folder}</span>
                  </div>
                  <div className="ml-5 border-l border-[#2b3545] pl-2 space-y-1">
                    {folderNotes.map((note) => {
                      const active = currentNote?.id === note.id;
                      return (
                        <button
                          key={note.id}
                          onClick={() => { onSelectNote(note); setIsEditing(false); }}
                          className={`w-full min-h-8 px-2 py-1.5 text-left text-xs flex items-center gap-2 rounded-sm border ${active ? "bg-[#182234] text-slate-100 border-[#475569]" : "text-slate-400 border-transparent hover:bg-[#262a33] hover:text-slate-200"}`}
                        >
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{note.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-[#334155]">
            <button onClick={onOpenNewNoteModal} disabled={!connected} className="w-full h-9 rounded-sm bg-[#2563eb] hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-semibold">+ Nova Nota</button>
          </div>
        </aside>

        <main className="min-w-0 min-h-0 flex flex-col bg-[#0f131c]">
          {!currentNote ? (
            <div className="h-full flex items-center justify-center p-8 text-center">
              <div>
                <FolderOpen className="w-10 h-10 mx-auto text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-200 mt-4">Cofre sem conteúdo disponível</h2>
                <p className="text-sm text-slate-500 mt-2">Conecte e sincronize o Obsidian para carregar as notas reais do Vault.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-[#334155] shrink-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-3 overflow-hidden">
                      {(currentNote.path || currentNote.folder).split(/[\\/]/).filter(Boolean).slice(0, -1).map((part) => (
                        <React.Fragment key={part}><span className="truncate">{part}</span><ChevronRight className="w-3 h-3 shrink-0" /></React.Fragment>
                      ))}
                      <span className="text-slate-300 truncate">{currentNote.title}</span>
                    </div>
                    <h1 className="text-3xl md:text-[34px] font-bold tracking-tight text-slate-50 truncate">{currentNote.title}</h1>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className={`px-2 py-1 text-[10px] font-bold rounded-sm border ${String(currentNote.frontmatter?.status || "").toUpperCase() === "OFICIAL" ? "text-emerald-400 border-emerald-700 bg-emerald-950/20" : "text-amber-400 border-amber-700 bg-amber-950/20"}`}>{String(currentNote.frontmatter?.status || "NOVO").toUpperCase()}</span>
                      {(currentNote.tags || []).slice(0, 4).map((tag) => <span key={tag} className="px-2 py-1 text-[10px] font-mono text-slate-400 bg-[#1c2028] border border-[#334155] rounded-sm">#{tag}</span>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={startEditing} disabled={!connected || isEditing} className="h-9 px-4 rounded-sm border border-[#334155] bg-[#182234] hover:bg-[#26344b] disabled:opacity-40 text-xs font-semibold flex items-center gap-2"><Pencil className="w-4 h-4" /> Editar</button>
                    <button onClick={saveEditing} disabled={!connected || !isEditing || isPushingToApi} className="h-9 px-4 rounded-sm bg-[#2563eb] hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-xs font-semibold flex items-center gap-2"><Save className="w-4 h-4" /> {isPushingToApi ? "Salvando..." : "Salvar"}</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-[#263140]">
                  <button onClick={() => navigator.clipboard.writeText(currentNote.content)} className="h-8 px-3 rounded-sm border border-[#334155] text-xs text-slate-300 hover:bg-[#1c2028] flex items-center gap-2"><Copy className="w-3.5 h-3.5" /> Copiar MD</button>
                  <button onClick={() => onExtractTasksFromNote(currentNote)} disabled={isExtractingTasks} className="h-8 px-3 rounded-sm border border-[#334155] text-xs text-slate-300 hover:bg-[#1c2028] disabled:opacity-50 flex items-center gap-2"><CheckSquare className="w-3.5 h-3.5" /> {isExtractingTasks ? "Extraindo..." : "Extrair Tarefas"}</button>
                  <button onClick={openInObsidian} disabled={!connected} className="h-8 px-3 rounded-sm border border-violet-500/40 text-xs text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 disabled:opacity-40 flex items-center gap-2"><ExternalLink className="w-3.5 h-3.5" /> Abrir no Obsidian</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                {isEditing ? (
                  <textarea
                    value={editingContent}
                    onChange={(event) => setEditingContent(event.target.value)}
                    className="w-full min-h-full resize-none bg-[#111827] border border-[#334155] rounded-sm p-5 text-sm leading-6 text-slate-200 font-mono outline-none focus:border-blue-500"
                  />
                ) : (
                  <div className="max-w-4xl">{renderMarkdownPreview(currentNote.content)}</div>
                )}
              </div>
            </>
          )}
        </main>

        <aside className="hidden lg:flex bg-[#1c2028] border-l border-[#334155] flex-col min-h-0">
          <div className="h-[60px] px-5 flex items-center justify-between border-b border-[#334155]">
            <h2 className="text-lg font-semibold text-slate-100">Metadata</h2>
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {currentNote ? (
              <>
                <section>
                  <h3 className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-3">Frontmatter</h3>
                  <div className="bg-[#111827] border border-[#334155] p-3 font-mono text-xs leading-6">
                    {Object.entries(currentNote.frontmatter || {}).slice(0, 10).map(([key, value]) => (
                      <div key={key} className="flex gap-2 min-w-0">
                        <span className="text-cyan-300 shrink-0">{key}:</span>
                        <span className="text-slate-400 break-all">{Array.isArray(value) ? value.join(", ") : String(value)}</span>
                      </div>
                    ))}
                    {Object.keys(currentNote.frontmatter || {}).length === 0 && <span className="text-slate-600">Sem frontmatter.</span>}
                  </div>
                </section>

                <section>
                  <h3 className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-3">Conexões</h3>
                  <p className="text-xs text-slate-500 mb-2">Links de saída (Wikilinks)</p>
                  <div className="space-y-1.5">
                    {(currentNote.wikilinks || []).slice(0, 8).map((link) => (
                      <div key={link} className="inline-flex max-w-full items-center gap-1.5 mr-1 px-2 py-1 rounded-sm bg-violet-500/10 border border-violet-500/25 text-violet-300 text-xs font-mono"><Link2 className="w-3 h-3 shrink-0" /><span className="truncate">[[{link}]]</span></div>
                    ))}
                    {(currentNote.wikilinks || []).length === 0 && <p className="text-xs text-slate-600">Nenhum wikilink.</p>}
                  </div>

                  <p className="text-xs text-slate-500 mt-5 mb-2">Backlinks (mencionam esta nota)</p>
                  <div className="space-y-2">
                    {backlinks.slice(0, 8).map((note) => (
                      <button key={note.id} onClick={() => onSelectNote(note)} className="w-full text-left flex items-center gap-2 text-xs text-slate-300 hover:text-white"><FileText className="w-3.5 h-3.5 text-slate-500" /><span className="truncate">{note.title}</span></button>
                    ))}
                    {backlinks.length === 0 && <p className="text-xs text-slate-600">Nenhum backlink.</p>}
                  </div>
                </section>

                <section>
                  <h3 className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-3">Arquivo</h3>
                  <div className="space-y-2 text-xs text-slate-400">
                    <div className="flex items-start gap-2"><FolderOpen className="w-4 h-4 shrink-0" /><span className="break-all">{currentNote.path}</span></div>
                    <div className="flex items-center gap-2"><Tag className="w-4 h-4 shrink-0" /><span>{(currentNote.tags || []).length} tags</span></div>
                  </div>
                </section>
              </>
            ) : <p className="text-xs text-slate-600">Selecione uma nota para ver os metadados.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
};
