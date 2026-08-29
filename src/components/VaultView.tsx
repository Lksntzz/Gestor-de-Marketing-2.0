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
  Tags,
  Clock3,
  ShieldCheck,
} from "lucide-react";
import type { ObsidianNote, ObsidianApiConfig } from "../types";
import { buildObsidianOpenUri } from "../utils/obsidianUri";
import { api } from "../services/api";
import { OBSIDIAN_DISCONNECTED_EVENT, OBSIDIAN_SNAPSHOT_EVENT } from "../services/obsidianRuntimeState";
import {
  cleanMarkdown,
  compactFolderSummary,
  epistemicState,
  folderContains,
  folderHasChildren,
  folderInsight,
  noteCategory,
  noteKeyFacts,
  noteKeywords,
  noteSummary,
  sourceKind,
  visibleFolders,
  type EpistemicState,
  type VaultSourceKind,
} from "../utils/vaultWorkspace";

interface VaultViewProps {
  notes: ObsidianNote[];
  selectedNote: ObsidianNote | null;
  onSelectNote: (note: ObsidianNote) => void;
  onUpdateNote: (updatedNote: ObsidianNote) => void;
  onOpenAddSource: () => void;
  onExtractTasksFromNote: (note: ObsidianNote) => void;
  onGenerateCampaignFromNote: (note: ObsidianNote) => void;
  onPushNoteToObsidianApi: (note: ObsidianNote) => void;
  apiConfig: ObsidianApiConfig;
  isExtractingTasks: boolean;
  isPushingToApi: boolean;
}

const STATE_CLASS: Record<EpistemicState, string> = {
  CONFIRMADO: "text-emerald-700 bg-emerald-50 border-emerald-200",
  HIPÓTESE: "text-amber-700 bg-amber-50 border-amber-200",
  PENDENTE: "text-stone-600 bg-stone-100 border-stone-200",
};

const KIND_LABEL: Record<VaultSourceKind, string> = {
  markdown: "Markdown",
  text: "Texto",
  pdf: "PDF",
  image: "Imagem",
};

function sourceIcon(kind: VaultSourceKind) {
  if (kind === "image") return FileImage;
  if (kind === "pdf") return FileType2;
  return FileText;
}

function shortTimestamp(value?: string): string {
  const raw = value?.trim();
  if (!raw) return "Sem data";
  const normalized = raw.includes(" ") && !raw.includes("T") ? raw.replace(" ", "T") : raw;
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) return raw;
  const date = new Date(timestamp);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export const VaultView: React.FC<VaultViewProps> = ({
  notes,
  selectedNote,
  onSelectNote,
  onUpdateNote,
  onOpenAddSource,
  onExtractTasksFromNote,
  onGenerateCampaignFromNote,
  onPushNoteToObsidianApi: _onPushNoteToObsidianApi,
  apiConfig,
  isExtractingTasks,
  isPushingToApi: _isPushingToApi,
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
  const [runtimeConnected, setRuntimeConnected] = useState(() => api.isObsidianSessionVerified());

  const isConnected = runtimeConnected && apiConfig.connectionStatus === "connected";
  const visibleNotes = isConnected ? notes : [];

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onSnapshot = (event: Event) => {
      const detail = (event as CustomEvent<{ folders?: string[] }>).detail;
      setRuntimeConnected(api.isObsidianSessionVerified());
      if (Array.isArray(detail?.folders)) setVaultFolders(detail.folders);
      setError(null);
    };

    const onDisconnected = () => {
      setRuntimeConnected(false);
      setVaultFolders([]);
      setSelectedFolder(null);
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
    const verified = api.isObsidianSessionVerified();
    setRuntimeConnected(verified);
    if (!verified || apiConfig.connectionStatus !== "connected" || !window.electronAPI) return;

    void window.electronAPI
      .listVaultFolders()
      .then((folders) => {
        if (Array.isArray(folders)) setVaultFolders(folders as string[]);
      })
      .catch(() => setVaultFolders([]));
  }, [notes, apiConfig.connectionStatus]);

  const allFolders = useMemo(() => {
    if (!isConnected) return [];
    const set = new Set<string>(vaultFolders);
    visibleNotes.forEach((note) => set.add(note.folder || "00_Inbox"));
    return Array.from(set).filter((value): value is string => Boolean(value)).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [vaultFolders, visibleNotes, isConnected]);

  const renderedFolders = useMemo(() => visibleFolders(allFolders, collapsed), [allFolders, collapsed]);

  const filteredNotes = useMemo(() => {
    if (!isConnected) return [];
    const term = search.toLowerCase().trim();

    return visibleNotes
      .filter((note) => {
        const folderMatch = !selectedFolder || folderContains(selectedFolder, note.folder || "00_Inbox");
        if (!folderMatch) return false;
        if (!term) return true;

        const searchable = [
          note.title,
          note.folder,
          noteSummary(note),
          cleanMarkdown(note.content),
          noteCategory(note) || "",
          ...noteKeywords(note),
        ]
          .join(" ")
          .toLowerCase();
        return searchable.includes(term);
      })
      .sort((a, b) => {
        const aTime = Date.parse((a.lastModified || "").replace(" ", "T"));
        const bTime = Date.parse((b.lastModified || "").replace(" ", "T"));
        if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return bTime - aTime;
        return a.title.localeCompare(b.title, "pt-BR");
      });
  }, [visibleNotes, selectedFolder, search, isConnected]);

  const current =
    selectedNote && filteredNotes.some((note) => note.path === selectedNote.path)
      ? selectedNote
      : filteredNotes[0] || null;

  const selectedFolderInsight = useMemo(
    () => folderInsight(visibleNotes, selectedFolder),
    [visibleNotes, selectedFolder],
  );

  const currentSummary = current ? noteSummary(current) : "";
  const currentPoints = current ? noteKeyFacts(current) : [];
  const currentKind = current ? sourceKind(current) : "markdown";
  const currentState = current ? epistemicState(current) : "PENDENTE";
  const currentCategory = current ? noteCategory(current) : undefined;
  const currentKeywords = current ? noteKeywords(current) : [];
  const CurrentIcon = sourceIcon(currentKind);
  const sourcePath = current ? String(current.frontmatter?.asset_path || current.path) : "";
  const isReadOnlyAsset = current?.frontmatter?.source_type === "vault_asset";
  const canUseOperationally = Boolean(current && isConnected && currentState !== "PENDENTE");

  const openEdit = () => {
    if (!current || !isConnected) {
      setError("Conecte o Obsidian antes de editar o conhecimento.");
      return;
    }
    if (isReadOnlyAsset) {
      setError("PDFs, imagens e arquivos externos são fontes somente leitura. Edite o arquivo original no Obsidian.");
      return;
    }
    setError(null);
    setEditingContent(current.content);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!current || !isConnected || isReadOnlyAsset) return;
    setIsSaving(true);
    setError(null);

    try {
      const result = await api.pushNoteToObsidian(apiConfig, current.path, editingContent, current.frontmatter);
      if (!result?.success) throw new Error(result?.message || "O Obsidian não confirmou a gravação.");

      const updated: ObsidianNote = {
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

  const copySummary = async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(currentSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Não foi possível copiar a síntese para a área de transferência.");
    }
  };

  return (
    <div className="h-[calc(100vh-7.5rem)] md:h-[calc(100vh-5rem)] overflow-hidden flex flex-col gap-3 min-h-0">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-stone-400"}`} />
            <span className="text-[10px] uppercase tracking-wider font-bold text-stone-500">
              {isConnected ? "Obsidian validado" : "Cofre bloqueado"}
            </span>
          </div>
          <h1 className="text-xl font-black text-stone-950 mt-0.5">Cofre Obsidian</h1>
          <p className="text-[10px] text-stone-500 mt-0.5">O original permanece no Vault; o Nisti mostra apenas a síntese operacional.</p>
        </div>

        <button
          onClick={() => (isConnected ? onOpenAddSource() : setError("Conecte o Obsidian antes de adicionar uma fonte."))}
          className="h-9 px-3 rounded-xl bg-stone-900 text-white text-xs font-bold disabled:opacity-40"
          disabled={!isConnected}
        >
          <Plus className="w-3.5 h-3.5 inline mr-1.5" />
          Adicionar fonte
        </button>
      </div>

      {error && (
        <div className="shrink-0 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="shrink-0 rounded-xl border border-stone-200 bg-white px-3 py-2.5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Folder className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span className="text-[11px] font-black text-stone-900 truncate">
              {selectedFolder || "Todo o Vault"}
            </span>
          </div>
          <p className="text-[10px] text-stone-500 mt-1 truncate" title={compactFolderSummary(selectedFolderInsight)}>
            {compactFolderSummary(selectedFolderInsight)}
          </p>
        </div>

        {selectedFolderInsight.categories.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap xl:justify-end">
            {selectedFolderInsight.categories.map((category) => (
              <span key={category} className="px-2 py-1 rounded-full bg-stone-100 border border-stone-200 text-[9px] font-bold text-stone-600">
                {category}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-3 min-h-0 flex-1">
        <aside className="col-span-12 lg:col-span-3 rounded-2xl bg-white border border-stone-200 overflow-hidden flex flex-col min-h-0">
          <div className="p-3 border-b border-stone-100 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar fonte, resumo ou tag..."
                className="w-full h-9 rounded-xl bg-stone-50 border border-stone-200 pl-8 pr-3 text-xs outline-none focus:border-purple-400"
                disabled={!isConnected}
              />
            </div>
          </div>

          <div className="overflow-y-auto p-2 flex-1 min-h-0">
            <button
              onClick={() => setSelectedFolder(null)}
              className={`w-full h-9 px-2 rounded-lg flex items-center justify-between text-left text-[11px] font-bold ${
                selectedFolder === null ? "bg-purple-50 text-purple-900" : "hover:bg-stone-50 text-stone-700"
              }`}
              disabled={!isConnected}
            >
              <span className="flex items-center gap-2">
                <Folder className="w-3.5 h-3.5 text-purple-600" />
                Todo o Vault
              </span>
              <span className="text-stone-400">{visibleNotes.length}</span>
            </button>

            {renderedFolders.map((folder) => {
              const depth = folder.split("/").length - 1;
              const count = visibleNotes.filter((note) => folderContains(folder, note.folder || "00_Inbox")).length;
              const hasChildren = folderHasChildren(folder, allFolders);
              const isCollapsed = Boolean(collapsed[folder]);

              return (
                <div key={folder} style={{ paddingLeft: Math.min(depth * 10, 30) }}>
                  <div className={`h-9 rounded-lg flex items-center ${selectedFolder === folder ? "bg-purple-50" : "hover:bg-stone-50"}`}>
                    {hasChildren ? (
                      <button
                        onClick={() => setCollapsed((previous) => ({ ...previous, [folder]: !previous[folder] }))}
                        className="w-6 h-8 flex items-center justify-center text-stone-400"
                        title={isCollapsed ? "Expandir pasta" : "Recolher pasta"}
                      >
                        {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    ) : (
                      <span className="w-6 h-8" />
                    )}

                    <button
                      onClick={() => {
                        setSelectedFolder(folder);
                        setEditing(false);
                        setError(null);
                      }}
                      className={`min-w-0 flex-1 text-left text-[11px] font-semibold truncate ${
                        selectedFolder === folder ? "text-purple-900" : "text-stone-700"
                      }`}
                      title={folder}
                    >
                      {folder.split("/").pop()}
                    </button>
                    <span className="text-[9px] text-stone-400 pr-2">{count}</span>
                  </div>
                </div>
              );
            })}

            {isConnected && allFolders.length === 0 && (
              <div className="px-3 py-6 text-center text-[10px] text-stone-500">Nenhuma pasta encontrada no Vault.</div>
            )}
          </div>
        </aside>

        <section className="col-span-12 lg:col-span-4 rounded-2xl bg-white border border-stone-200 overflow-hidden flex flex-col min-h-0">
          <div className="h-12 px-4 border-b border-stone-100 flex items-center justify-between shrink-0">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Fontes</div>
              <div className="text-[10px] text-stone-400">
                {filteredNotes.length} {filteredNotes.length === 1 ? "item" : "itens"}
              </div>
            </div>
            {search && (
              <button onClick={() => setSearch("")} className="text-[10px] font-bold text-purple-700 hover:underline">
                Limpar busca
              </button>
            )}
          </div>

          <div className="overflow-y-auto p-2 flex-1 min-h-0 space-y-1">
            {filteredNotes.map((note) => {
              const kind = sourceKind(note);
              const state = epistemicState(note);
              const Icon = sourceIcon(kind);
              const active = current?.path === note.path;

              return (
                <button
                  key={note.path}
                  onClick={() => {
                    onSelectNote(note);
                    setEditing(false);
                    setError(null);
                  }}
                  className={`w-full min-h-20 rounded-xl px-3 py-2.5 flex items-start gap-2.5 text-left border transition-colors ${
                    active
                      ? "bg-purple-50 border-purple-200"
                      : "bg-white border-transparent hover:border-stone-200 hover:bg-stone-50"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${active ? "bg-white text-purple-700" : "bg-stone-100 text-stone-500"}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-stone-900 truncate">{note.title}</div>
                      <span className={`px-1.5 py-0.5 rounded border text-[8px] font-black shrink-0 ${STATE_CLASS[state]}`}>
                        {state}
                      </span>
                    </div>
                    <div className="text-[10px] text-stone-500 line-clamp-2 mt-0.5">{noteSummary(note)}</div>
                    <div className="flex items-center gap-2 mt-1.5 text-[9px] text-stone-400">
                      <span>{KIND_LABEL[kind]}</span>
                      <span>•</span>
                      <span>{shortTimestamp(note.lastModified)}</span>
                    </div>
                  </div>
                </button>
              );
            })}

            {!isConnected && (
              <div className="h-full min-h-32 flex items-center justify-center text-xs text-stone-500 text-center p-4">
                Conecte e valide o Obsidian para visualizar o banco de conhecimento.
              </div>
            )}

            {isConnected && filteredNotes.length === 0 && (
              <div className="h-32 flex items-center justify-center text-xs text-stone-500 text-center p-4">
                Nenhuma fonte corresponde à pasta ou busca atual.
              </div>
            )}
          </div>
        </section>

        <section className="col-span-12 lg:col-span-5 rounded-2xl bg-white border border-stone-200 overflow-hidden flex flex-col min-h-0">
          {current && isConnected ? (
            <>
              <div className="px-4 py-3 border-b border-stone-100 flex items-start justify-between gap-3 shrink-0">
                <div className="min-w-0 flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                    <CurrentIcon className="w-4 h-4 text-purple-700" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className="text-sm font-black text-stone-950 truncate">{current.title}</h2>
                      <span className={`px-1.5 py-0.5 rounded border text-[8px] font-black shrink-0 ${STATE_CLASS[currentState]}`}>
                        {currentState}
                      </span>
                    </div>
                    <div className="text-[10px] text-stone-500 truncate mt-0.5">{sourcePath}</div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={copySummary} className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center" title="Copiar síntese">
                    <Copy className="w-3.5 h-3.5 text-stone-500" />
                  </button>
                  {!isReadOnlyAsset && (
                    <button onClick={openEdit} className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center" title="Editar Markdown">
                      <Edit3 className="w-3.5 h-3.5 text-stone-500" />
                    </button>
                  )}
                  <a
                    href={buildObsidianOpenUri(apiConfig.vaultName, sourcePath)}
                    className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center"
                    title="Abrir fonte no Obsidian"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
                  </a>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 min-h-0 p-4 space-y-4">
                {editing ? (
                  <div className="h-full min-h-[360px] flex flex-col gap-3">
                    <textarea
                      value={editingContent}
                      onChange={(event) => setEditingContent(event.target.value)}
                      className="flex-1 min-h-[300px] rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs font-mono outline-none focus:border-purple-400"
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditing(false)} className="h-9 px-3 rounded-xl border border-stone-200 text-xs font-bold">
                        Cancelar
                      </button>
                      <button
                        onClick={saveEdit}
                        disabled={isSaving}
                        className="h-9 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
                      >
                        {isSaving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />
                        ) : (
                          <Check className="w-3.5 h-3.5 inline mr-1" />
                        )}
                        Salvar no Obsidian
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl bg-stone-50 border border-stone-100 p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="text-[10px] uppercase tracking-wider font-bold text-stone-500">Síntese</div>
                        <span className="text-[9px] text-stone-400">Fonte completa no Obsidian</span>
                      </div>
                      <p className="text-xs leading-relaxed text-stone-700">{currentSummary}</p>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-2">Pontos estruturados</div>
                      {currentPoints.length ? (
                        <div className="space-y-2">
                          {currentPoints.map((point, index) => (
                            <div key={`${point}-${index}`} className="flex items-start gap-2 text-xs text-stone-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                              <span>{point}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-stone-500">A fonte ainda não possui pontos importantes estruturados explicitamente.</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-stone-200 p-3">
                        <div className="text-[9px] uppercase font-bold text-stone-400">Estado</div>
                        <div className="text-[11px] font-bold text-stone-800 mt-1">{currentState}</div>
                      </div>
                      <div className="rounded-xl border border-stone-200 p-3">
                        <div className="text-[9px] uppercase font-bold text-stone-400">Tipo</div>
                        <div className="text-[11px] font-bold text-stone-800 mt-1">{KIND_LABEL[currentKind]}</div>
                      </div>
                      <div className="rounded-xl border border-stone-200 p-3">
                        <div className="text-[9px] uppercase font-bold text-stone-400">Categoria</div>
                        <div className="text-[11px] font-bold text-stone-800 mt-1 truncate">{currentCategory || "Não definida"}</div>
                      </div>
                      <div className="rounded-xl border border-stone-200 p-3">
                        <div className="text-[9px] uppercase font-bold text-stone-400">Atualização</div>
                        <div className="text-[11px] font-bold text-stone-800 mt-1">{shortTimestamp(current.lastModified)}</div>
                      </div>
                    </div>

                    {currentKeywords.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-2 flex items-center gap-1.5">
                          <Tags className="w-3 h-3" />
                          Tags
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {currentKeywords.map((keyword) => (
                            <span key={keyword} className="px-2 py-1 rounded-full bg-stone-100 border border-stone-200 text-[9px] font-bold text-stone-600">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {isReadOnlyAsset && current.frontmatter?.visible_text && (
                      <div className="rounded-xl border border-stone-200 bg-white p-3 flex items-start gap-2">
                        <FileText className="w-3.5 h-3.5 text-stone-500 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[10px] font-bold text-stone-700">Texto extraído disponível</div>
                          <div className="text-[9px] text-stone-500 mt-0.5">O conteúdo completo permanece oculto nesta tela para manter o cofre enxuto.</div>
                        </div>
                      </div>
                    )}

                    {currentState === "PENDENTE" && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[10px] text-amber-900 flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        Esta fonte está PENDENTE. Revise ou confirme o conhecimento antes de utilizá-lo para gerar campanha ou tarefas.
                      </div>
                    )}

                    <div className="pt-3 border-t border-stone-100 flex flex-wrap gap-2">
                      <button
                        onClick={() => current && onGenerateCampaignFromNote(current)}
                        disabled={!canUseOperationally}
                        className="h-9 px-3 rounded-xl bg-purple-700 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />
                        Usar no marketing
                      </button>
                      <button
                        onClick={() => current && onExtractTasksFromNote(current)}
                        disabled={!canUseOperationally || isExtractingTasks}
                        className="h-9 px-3 rounded-xl border border-stone-200 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isExtractingTasks ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" /> : null}
                        Extrair tarefas
                      </button>
                    </div>

                    {copied && <div className="text-[10px] text-emerald-700 font-bold">Síntese copiada.</div>}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-center p-8">
              <div>
                {isConnected ? (
                  <FileText className="w-7 h-7 text-stone-300 mx-auto mb-2" />
                ) : (
                  <ShieldCheck className="w-7 h-7 text-stone-300 mx-auto mb-2" />
                )}
                <p className="text-sm font-bold text-stone-700">
                  {isConnected ? "Selecione uma fonte" : "Banco de conhecimento bloqueado"}
                </p>
                <p className="text-xs text-stone-500 mt-1 max-w-sm">
                  {isConnected
                    ? "O sistema mostra somente a síntese operacional; o contexto completo permanece no Obsidian."
                    : "Valide a REST API e a pasta física do Vault para liberar as informações do cofre."}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="h-8 shrink-0 rounded-xl border border-stone-200 bg-white px-3 flex items-center justify-between gap-3 text-[9px] text-stone-500 overflow-hidden">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center gap-1.5 shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-stone-400"}`} />
            {isConnected ? "Obsidian conectado" : "Obsidian desconectado"}
          </span>
          <span className="truncate">{allFolders.length} pastas</span>
          <span className="truncate">{visibleNotes.length} fontes indexadas</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Clock3 className="w-3 h-3" />
          <span>{apiConfig.lastSyncTime ? `Última sync: ${apiConfig.lastSyncTime}` : "Sem sincronização registrada"}</span>
        </div>
      </div>
    </div>
  );
};
