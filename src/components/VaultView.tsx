import React, { useState, useMemo } from "react";
import {
  FolderOpen,
  FileText,
  Search,
  Plus,
  ExternalLink,
  Download,
  Sparkles,
  Tag,
  Link2,
  Eye,
  Edit3,
  Calendar,
  ChevronDown,
  ChevronRight,
  Check,
  SlidersHorizontal,
  Copy,
  Layers,
  FileCode,
  Folder,
} from "lucide-react";
import { ObsidianNote, ObsidianApiConfig } from "../types";
import {
  buildObsidianOpenUri,
  downloadMarkdownFile,
} from "../utils/obsidianUri";
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
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  // Layout: Modo Avançado (Metadados e Backlinks em painel colapsável)
  const [isAdvancedMetaOpen, setIsAdvancedMetaOpen] = useState(false);

  // Collapsed folders state
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  const toggleFolder = (folderName: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName],
    }));
  };

  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Group notes by folder
  const folders = useMemo(() => {
    const map = new Map<string, ObsidianNote[]>();
    notes.forEach((note) => {
      const f = note.folder || "00_Inbox";
      if (!map.has(f)) map.set(f, []);
      map.get(f)!.push(note);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [notes]);

  // All unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((n) => (n.tags || []).forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [notes]);

  // Filtered notes
  const filteredNotes = useMemo(() => {
    const term = (searchTerm || "").toLowerCase().trim();
    return notes.filter((n) => {
      const matchSearch =
        !term ||
        (n.title || "").toLowerCase().includes(term) ||
        (n.content || "").toLowerCase().includes(term);
      const matchTag = selectedTag ? (n.tags || []).includes(selectedTag) : true;
      const matchStatus = statusFilter ? (n.frontmatter?.status === statusFilter) : true;
      return matchSearch && matchTag && matchStatus;
    });
  }, [notes, searchTerm, selectedTag, statusFilter]);

  // Active note
  const currentNote = selectedNote || notes[0] || null;

  // Backlinks (notes that link to current note)
  const backlinks = useMemo(() => {
    if (!currentNote || !currentNote.title) return [];
    const targetTitle = currentNote.title.toLowerCase();
    return notes.filter(
      (n) => n.id !== currentNote.id && (n.wikilinks || []).some((w) => (w || "").toLowerCase() === targetTitle)
    );
  }, [notes, currentNote]);

  const handleStartEdit = () => {
    if (currentNote) {
      setEditingContent(currentNote.content);
      setIsEditing(true);
      setViewMode("edit");
    }
  };

  const handleSaveEdit = () => {
    if (currentNote) {
      onUpdateNote({
        ...currentNote,
        content: editingContent,
        lastModified: new Date().toISOString().replace("T", " ").slice(0, 16),
      });
      setIsEditing(false);
      setViewMode("preview");
      setSaveFeedback(true);
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
      setTimeout(() => setSaveFeedback(false), 2000);
    }
  };

  const handleCopyMarkdown = () => {
    if (currentNote) {
      navigator.clipboard.writeText(currentNote.content);
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 1800);
    }
  };

  return (
    <div className="w-full px-4 md:px-8 lg:px-12 space-y-6 pb-16 animate-fadeIn">
      
      {/* 1. CABEÇALHO CONHECIMENTO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200 uppercase tracking-wider">
              {notes.length} Documentos Markdown
            </span>
            <span className="text-xs text-stone-400 font-medium">
              Leitura sem distrações
            </span>
          </div>
          <h1 className="text-xl font-black text-stone-900 tracking-tight mt-1">
            Conhecimento (Cofre PKM)
          </h1>
          <p className="text-xs text-stone-500">
            Navegue pelas suas diretrizes, personas, produtos e notas do Obsidian.
          </p>
        </div>

        <button
          onClick={onOpenNewNoteModal}
          className="px-4 py-2 bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 self-start sm:self-center cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-purple-400" />
          <span>+ Nova Nota</span>
        </button>
      </div>

      {/* 2. ESTRUTURA PRINCIPAL: ÁRVORE À ESQUERDA, CONTEÚDO AO CENTRO, MODO AVANÇADO À DIREITA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLUNA ESQUERDA: ÁRVORE DE PASTAS & BUSCA (4 colunas no desktop) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Caixa de Busca e Filtro de Tags */}
          <div className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-3xs space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar notas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200/80 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center gap-1 pt-0.5">
              <button
                onClick={() => setStatusFilter(null)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                  statusFilter === null
                    ? "bg-stone-900 text-white"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setStatusFilter(statusFilter === "OFICIAL" ? null : "OFICIAL")}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                  statusFilter === "OFICIAL"
                    ? "bg-emerald-700 text-white"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-200/60 hover:bg-emerald-100"
                }`}
              >
                OFICIAL
              </button>
              <button
                onClick={() => setStatusFilter(statusFilter === "EM REVISÃO" ? null : "EM REVISÃO")}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                  statusFilter === "EM REVISÃO"
                    ? "bg-amber-700 text-white"
                    : "bg-amber-50 text-amber-800 border border-amber-200/60 hover:bg-amber-100"
                }`}
              >
                EM REVISÃO
              </button>
              <button
                onClick={() => setStatusFilter(statusFilter === "NOVO" ? null : "NOVO")}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                  statusFilter === "NOVO"
                    ? "bg-blue-700 text-white"
                    : "bg-blue-50 text-blue-800 border border-blue-200/60 hover:bg-blue-100"
                }`}
              >
                NOVO
              </button>
            </div>

            {/* Tags Pills */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1 max-h-20 overflow-y-auto border-t border-stone-100">
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all cursor-pointer ${
                    selectedTag === null
                      ? "bg-purple-700 text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  Todas as tags
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-all cursor-pointer ${
                      selectedTag === tag
                        ? "bg-purple-700 text-white"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Árvore de Pastas & Documentos */}
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-3xs p-3 space-y-3 max-h-[620px] overflow-y-auto">
            {folders.map(([folderName, folderNotes]) => {
              const isCollapsed = collapsedFolders[folderName];
              const visibleFolderNotes = folderNotes.filter((n) => filteredNotes.some((fn) => fn.id === n.id));

              if (visibleFolderNotes.length === 0 && (searchTerm || selectedTag)) {
                return null;
              }

              return (
                <div key={folderName} className="space-y-1">
                  {/* Folder Header */}
                  <button
                    onClick={() => toggleFolder(folderName)}
                    className="w-full flex items-center justify-between p-1.5 text-stone-700 hover:bg-stone-50 rounded-lg text-left text-xs font-bold transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-1.5">
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
                      )}
                      <Folder className="w-3.5 h-3.5 text-purple-600" />
                      <span className="truncate">{folderName}</span>
                    </div>
                    <span className="text-[10px] font-mono text-stone-400 group-hover:text-stone-700">
                      {folderNotes.length}
                    </span>
                  </button>

                  {/* Notes Inside Folder */}
                  {!isCollapsed && (
                    <div className="pl-4 space-y-0.5 border-l border-stone-150 ml-2">
                      {visibleFolderNotes.map((note) => {
                        const isSelected = currentNote?.id === note.id;
                        return (
                          <button
                            key={note.id}
                            onClick={() => {
                              onSelectNote(note);
                              setIsEditing(false);
                              setViewMode("preview");
                            }}
                            className={`w-full text-left p-2 rounded-xl text-xs transition-all flex items-center justify-between gap-2 cursor-pointer ${
                              isSelected
                                ? "bg-purple-50 text-purple-900 font-bold border border-purple-200/80 shadow-3xs"
                                : "text-stone-700 hover:bg-stone-50 hover:text-stone-900"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <FileText className={`w-3 h-3 shrink-0 ${isSelected ? "text-purple-600" : "text-stone-400"}`} />
                              <span className="truncate">{note.title}</span>
                            </div>
                            {note.tags && note.tags.length > 0 && (
                              <span className="text-[9px] text-stone-400 shrink-0">
                                #{note.tags[0]}
                              </span>
                            )}
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

        {/* COLUNA CENTRAL: CONTEÚDO DA NOTA EM DESTAQUE (8 colunas no desktop) */}
        <div className="lg:col-span-8 space-y-4">
          {currentNote ? (
            <div className="bg-white rounded-3xl border border-stone-200/80 shadow-3xs overflow-hidden">
              
              {/* Barra Superior da Nota: Título, Ações e Modo Avançado */}
              <div className="p-5 sm:px-7 border-b border-stone-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/40">
                <div>
                  <div className="flex items-center gap-2 text-[11px] text-stone-400">
                    <span className="font-mono">{currentNote.folder || "00_Inbox"}</span>
                    <span>•</span>
                    <span>Modificado {currentNote.lastModified}</span>
                  </div>
                  <div className="flex items-center gap-2.5 mt-0.5">
                    <h2 className="text-lg font-black text-stone-900 tracking-tight">
                      {currentNote.title}
                    </h2>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        currentNote.frontmatter?.status === "OFICIAL"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : currentNote.frontmatter?.status === "EM REVISÃO"
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-blue-50 text-blue-800 border-blue-200"
                      }`}
                    >
                      {currentNote.frontmatter?.status || "OFICIAL"}
                    </span>
                  </div>
                </div>

                {/* Toolbar de Ações Limpa */}
                <div className="flex items-center gap-1.5 self-start sm:self-center">
                  <button
                    onClick={() => {
                      if (viewMode === "preview") {
                        handleStartEdit();
                      } else {
                        handleSaveEdit();
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      viewMode === "edit"
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                        : "bg-white hover:bg-stone-100 text-stone-700 border border-stone-200"
                    }`}
                  >
                    {viewMode === "edit" ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Salvar</span>
                      </>
                    ) : (
                      <>
                        <Edit3 className="w-3.5 h-3.5 text-stone-500" />
                        <span>Editar</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleCopyMarkdown}
                    className="p-2 bg-white hover:bg-stone-100 text-stone-600 rounded-xl border border-stone-200 transition-all cursor-pointer"
                    title="Copiar Markdown"
                  >
                    {copiedMarkdown ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <a
                    href={buildObsidianOpenUri(apiConfig.vaultName, currentNote.path)}
                    className="p-2 bg-white hover:bg-stone-100 text-stone-600 rounded-xl border border-stone-200 transition-all"
                    title="Abrir no app Obsidian"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  {/* Toggle Modo Avançado */}
                  <button
                    onClick={() => setIsAdvancedMetaOpen(!isAdvancedMetaOpen)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      isAdvancedMetaOpen
                        ? "bg-purple-100 text-purple-900 border border-purple-300"
                        : "bg-white hover:bg-stone-100 text-stone-600 border border-stone-200"
                    }`}
                    title="Alternar painel de metadados, backlinks e YAML avançado"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Modo Avançado</span>
                  </button>
                </div>
              </div>

              {/* PAINEL DE MODO AVANÇADO (RECOLHÍVEL / MODAL LATERAL) */}
              {isAdvancedMetaOpen && (
                <div className="bg-stone-50 border-b border-stone-200 p-5 space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                      Metadados & Conexões Atômicas (Modo Avançado)
                    </span>
                    <span className="text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded font-mono">
                      {currentNote.path}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {/* Frontmatter YAML */}
                    <div className="bg-white p-3.5 rounded-xl border border-stone-200 space-y-2">
                      <span className="text-[10px] font-bold text-stone-500 uppercase flex items-center gap-1">
                        <FileCode className="w-3 h-3 text-purple-600" />
                        <span>Frontmatter YAML</span>
                      </span>
                      <div className="font-mono text-[11px] text-stone-700 bg-stone-50 p-2 rounded-lg space-y-1">
                        {currentNote.frontmatter && Object.keys(currentNote.frontmatter).length > 0 ? (
                          Object.entries(currentNote.frontmatter).map(([k, v]) => (
                            <div key={k}>
                              <span className="text-purple-700">{k}:</span> {String(v)}
                            </div>
                          ))
                        ) : (
                          <span className="text-stone-400">Nenhum YAML declarado</span>
                        )}
                      </div>
                    </div>

                    {/* Backlinks Conectados */}
                    <div className="bg-white p-3.5 rounded-xl border border-stone-200 space-y-2">
                      <span className="text-[10px] font-bold text-stone-500 uppercase flex items-center gap-1">
                        <Link2 className="w-3 h-3 text-purple-600" />
                        <span>Backlinks ({backlinks.length})</span>
                      </span>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {backlinks.length > 0 ? (
                          backlinks.map((b) => (
                            <button
                              key={b.id}
                              onClick={() => onSelectNote(b)}
                              className="text-left w-full text-xs text-purple-700 hover:underline flex items-center gap-1 font-mono"
                            >
                              <span>[[{b.title}]]</span>
                            </button>
                          ))
                        ) : (
                          <span className="text-stone-400 text-[11px]">Nenhuma nota aponta para cá</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ações Inteligentes IA / Motor Local */}
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => onGenerateCampaignFromNote(currentNote)}
                      className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                      <span>Gerar Campanha com esta Nota</span>
                    </button>

                    <button
                      onClick={() => onExtractTasksFromNote(currentNote)}
                      disabled={isExtractingTasks}
                      className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-800 text-xs font-bold rounded-xl border border-stone-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5 text-stone-500" />
                      <span>{isExtractingTasks ? "Extraindo..." : "Extrair Tarefas para Centro"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* CORPO DE LEITURA OU EDIÇÃO DA NOTA */}
              <div className="p-6 sm:p-8">
                {viewMode === "edit" ? (
                  <div className="space-y-3">
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="w-full h-[450px] p-4 bg-stone-50 border border-stone-200 rounded-2xl font-mono text-xs text-stone-900 leading-relaxed focus:outline-none focus:border-purple-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setViewMode("preview");
                        }}
                        className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-3xs"
                      >
                        Salvar Alterações
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Renderizador de Leitura Limpo */
                  <div className="prose prose-stone max-w-none text-stone-800 text-sm leading-relaxed font-sans space-y-4">
                    {(currentNote.content || "").split("\n\n").map((paragraph, index) => {
                      if (!paragraph) return null;
                      // Headings
                      if (paragraph.startsWith("# ")) {
                        return (
                          <h1 key={index} className="text-xl font-black text-stone-900 pt-2 pb-1 border-b border-stone-150">
                            {paragraph.replace("# ", "")}
                          </h1>
                        );
                      }
                      if (paragraph.startsWith("## ")) {
                        return (
                          <h2 key={index} className="text-base font-bold text-stone-900 pt-2">
                            {paragraph.replace("## ", "")}
                          </h2>
                        );
                      }
                      if (paragraph.startsWith("### ")) {
                        return (
                          <h3 key={index} className="text-sm font-bold text-stone-800">
                            {paragraph.replace("### ", "")}
                          </h3>
                        );
                      }

                      // Lists
                      if (paragraph.includes("\n- ") || paragraph.startsWith("- ")) {
                        const items = paragraph.split("\n- ").map((item) => (item || "").replace(/^- /, ""));
                        return (
                          <ul key={index} className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-stone-700">
                            {items.map((it, i) => (
                              <li key={i}>{it}</li>
                            ))}
                          </ul>
                        );
                      }

                      // Blockquotes
                      if (paragraph.startsWith("> ")) {
                        return (
                          <blockquote key={index} className="border-l-4 border-purple-500 pl-4 py-1 italic text-stone-600 bg-purple-50/40 rounded-r-xl text-xs sm:text-sm">
                            {paragraph.replace(/^> /gm, "")}
                          </blockquote>
                        );
                      }

                      return (
                        <p key={index} className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                          {paragraph}
                        </p>
                      );
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
                <h3 className="text-base font-bold text-stone-800">Cofre Pronto e Limpo</h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Nenhuma nota selecionada. Você pode criar novas notas em Markdown com frontmatter estruturado, sincronizar diretamente com seu aplicativo Obsidian ou importar arquivos.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={onOpenNewNoteModal}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Criar Primeira Nota</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
