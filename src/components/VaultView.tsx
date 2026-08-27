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
  CheckSquare,
  ChevronsRight,
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

  // Breadcrumbs parsing
  const breadcrumbs = useMemo(() => {
    if (!currentNote) return ["Cofre"];
    const folderPath = currentNote.folder || "00_Inbox";
    const parts = folderPath.split("/");
    return [...parts, currentNote.title];
  }, [currentNote]);

  // Outgoing Wikilinks extracted from note content
  const outgoingLinks = useMemo(() => {
    if (!currentNote || !currentNote.content) return [];
    const matches = currentNote.content.match(/\[\[(.*?)\]\]/g) || [];
    return matches.map((m) => m.replace(/^\[\[/, "").replace(/\]\]$/, "")).filter(Boolean);
  }, [currentNote]);

  const handleToggleCheckboxInNote = (lineIdx: number) => {
    if (!currentNote) return;
    const lines = currentNote.content.split("\n");
    const line = lines[lineIdx];
    const checkboxMatch = line.match(/^(\s*-\s+\[)([ xX])(\]\s+.*)/);
    if (checkboxMatch) {
      const currentChecked = checkboxMatch[2].toLowerCase() === "x";
      const newCheckedChar = currentChecked ? " " : "x";
      lines[lineIdx] = `${checkboxMatch[1]}${newCheckedChar}${checkboxMatch[3]}`;
      
      onUpdateNote({
        ...currentNote,
        content: lines.join("\n"),
        lastModified: new Date().toISOString().replace("T", " ").slice(0, 16),
      });
    }
  };

  const handleWikilinkClick = (linkTitle: string) => {
    const cleanedTitle = linkTitle.trim().toLowerCase();
    const foundNote = notes.find((n) => (n.title || "").toLowerCase() === cleanedTitle);
    if (foundNote) {
      onSelectNote(foundNote);
      setIsEditing(false);
      setViewMode("preview");
    } else {
      // Small feedback
      confetti({ particleCount: 15, colors: ["#a855f7", "#3b82f6"] });
    }
  };

  const renderInlineMarkdown = (text: string) => {
    const wikilinkRegex = /\[\[(.*?)\]\]/g;
    let match;
    let lastIndex = 0;
    const parts: React.ReactNode[] = [];
    
    // Simple bold markdown parsing (**text**)
    const boldRegex = /\*\*(.*?)\*\*/g;
    
    // We parse wikilinks first
    while ((match = wikilinkRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      const linkText = match[1];
      
      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }
      
      parts.push(
        <span
          key={`wiki-${matchIndex}`}
          onClick={() => handleWikilinkClick(linkText)}
          className="wikilink px-1 py-0.5 rounded font-mono text-xs bg-purple-500/10 text-purple-200 border border-purple-500/20 cursor-pointer hover:bg-purple-500/20 active:scale-95 transition-all"
        >
          [[{linkText}]]
        </span>
      );
      
      lastIndex = wikilinkRegex.lastIndex;
    }
    
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    if (parts.length === 0) return text;
    return <>{parts}</>;
  };

  const renderMarkdown = (content: string) => {
    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockLines: string[] = [];
    let listItems: string[] = [];
    
    const flushList = (key: number) => {
      if (listItems.length === 0) return null;
      const listElement = (
        <ul key={`list-${key}`} className="list-disc pl-5 space-y-1 my-2 text-text-secondary">
          {listItems.map((item, idx) => (
            <li key={idx} className="text-xs sm:text-sm">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
      return listElement;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Code Block Detection
      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          elements.push(
            <pre key={`code-${i}`} className="bg-[#0F172A] p-4 rounded-xl border border-outline-border font-mono text-[11px] text-text-secondary leading-relaxed my-4 overflow-x-auto">
              <code>{codeBlockLines.join("\n")}</code>
            </pre>
          );
          codeBlockLines = [];
          inCodeBlock = false;
        } else {
          const list = flushList(i);
          if (list) elements.push(list);
          inCodeBlock = true;
        }
        continue;
      }
      
      if (inCodeBlock) {
        codeBlockLines.push(line);
        continue;
      }

      // Checkbox Lists (e.g. "- [ ] Task" or "- [x] Task")
      const checkboxMatch = line.match(/^(\s*)-\s+\[([ xX])\]\s+(.*)/);
      if (checkboxMatch) {
        const list = flushList(i);
        if (list) elements.push(list);
        
        const checked = checkboxMatch[2].toLowerCase() === "x";
        const text = checkboxMatch[3];
        elements.push(
          <div key={`todo-${i}`} className="flex items-start gap-3 p-3 bg-surface-card border border-outline-border rounded-xl hover:bg-surface-variant/35 transition-all my-2">
            <input
              type="checkbox"
              checked={checked}
              onChange={() => handleToggleCheckboxInNote(i)}
              className="mt-0.5 bg-background border-outline-border rounded text-primary focus:ring-primary focus:ring-offset-surface-card h-4 w-4 cursor-pointer"
            />
            <div className="flex-1">
              <p className={`text-xs sm:text-sm font-bold ${checked ? "line-through text-text-secondary" : "text-text-primary"}`}>
                {renderInlineMarkdown(text)}
              </p>
            </div>
          </div>
        );
        continue;
      }

      // Standard Lists
      if (line.trim().startsWith("- ")) {
        listItems.push(line.replace(/^\s*-\s+/, ""));
        continue;
      }

      const list = flushList(i);
      if (list) elements.push(list);

      // Empty Lines
      if (line.trim() === "") {
        elements.push(<div key={`empty-${i}`} className="h-2" />);
        continue;
      }

      // Headings
      if (line.startsWith("# ")) {
        elements.push(
          <h1 key={`h1-${i}`} className="font-headline-md text-xl sm:text-2xl font-black text-text-primary pt-3 pb-1.5 border-b border-outline-border/60 mt-5 mb-2.5 tracking-tight break-words">
            {renderInlineMarkdown(line.substring(2))}
          </h1>
        );
        continue;
      }
      if (line.startsWith("## ")) {
        elements.push(
          <h2 key={`h2-${i}`} className="font-headline-sm text-lg sm:text-xl font-black text-primary pt-2.5 pb-1 border-b border-outline-border/30 mt-4 mb-2 break-words">
            {renderInlineMarkdown(line.substring(3))}
          </h2>
        );
        continue;
      }
      if (line.startsWith("### ")) {
        elements.push(
          <h3 key={`h3-${i}`} className="font-body-bold text-sm sm:text-base font-bold text-text-primary mt-3 mb-1.5 break-words">
            {renderInlineMarkdown(line.substring(4))}
          </h3>
        );
        continue;
      }

      // Default Paragraph
      elements.push(
        <p key={`p-${i}`} className="font-body-base text-xs sm:text-sm text-text-secondary leading-relaxed mb-2.5 break-words">
          {renderInlineMarkdown(line)}
        </p>
      );
    }

    const final_list = flushList(lines.length);
    if (final_list) elements.push(final_list);

    return elements;
  };

  return (
    <div className="h-full w-full flex flex-col md:flex-row overflow-hidden bg-background text-text-primary select-none animate-fadeIn font-body-base min-h-0">
      
      {/* COLUMN 1: FILE EXPLORER (Left Column) */}
      <aside className="hidden md:flex w-64 border-r border-outline-border bg-surface-container flex-col shrink-0">
        
        {/* Search & Filter Block */}
        <div className="p-3 border-b border-outline-border flex flex-col gap-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary w-3.5 h-3.5" />
            <input
              type="text"
              placeholder="Filter files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-outline-border rounded-md pl-8 pr-2 py-1 font-body-sm text-body-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:border-motor-info focus:ring-1 focus:ring-motor-info transition-colors h-7"
            />
          </div>

          {/* Status Pills */}
          <div className="flex flex-wrap gap-1">
            <span
              onClick={() => setStatusFilter(null)}
              className={`font-label-caps text-label-caps px-2 py-0.5 rounded cursor-pointer transition-colors border ${
                statusFilter === null
                  ? "bg-surface-variant border-primary-container text-text-primary"
                  : "bg-surface-elevated border-outline-border text-text-secondary hover:border-outline-border/80"
              }`}
            >
              Todos
            </span>
            <span
              onClick={() => setStatusFilter(statusFilter === "OFICIAL" ? null : "OFICIAL")}
              className={`font-label-caps text-label-caps px-2 py-0.5 rounded cursor-pointer transition-colors border ${
                statusFilter === "OFICIAL"
                  ? "bg-success-sober/10 border-success-sober text-success-sober"
                  : "bg-surface-elevated border-outline-border text-text-secondary hover:border-success-sober/40"
              }`}
            >
              OFICIAL
            </span>
            <span
              onClick={() => setStatusFilter(statusFilter === "EM REVISÃO" ? null : "EM REVISÃO")}
              className={`font-label-caps text-label-caps px-2 py-0.5 rounded cursor-pointer transition-colors border ${
                statusFilter === "EM REVISÃO"
                  ? "bg-warning-sober/10 border-warning-sober text-warning-sober"
                  : "bg-surface-elevated border-outline-border text-text-secondary hover:border-warning-sober/40"
              }`}
            >
              EM REVISÃO
            </span>
            <span
              onClick={() => setStatusFilter(statusFilter === "NOVO" ? null : "NOVO")}
              className={`font-label-caps text-label-caps px-2 py-0.5 rounded cursor-pointer transition-colors border ${
                statusFilter === "NOVO"
                  ? "bg-motor-info/10 border-motor-info text-motor-info"
                  : "bg-surface-elevated border-outline-border text-text-secondary hover:border-motor-info/40"
              }`}
            >
              NOVO
            </span>
          </div>
        </div>

        {/* Tree List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-2 font-body-sm text-body-sm space-y-1">
          {apiConfig.connectionStatus !== "connected" ? (
            <div className="p-4 text-center space-y-2 bg-background/55 border border-dashed border-outline-border rounded-xl">
              <FolderOpen className="w-8 h-8 text-text-secondary mx-auto opacity-70" />
              <div className="space-y-0.5">
                <h5 className="text-xs font-bold text-text-primary">Cofre Desconectado</h5>
                <p className="text-[10px] text-text-secondary leading-normal">
                  Seus arquivos locais estão seguros e invisíveis.
                </p>
              </div>
            </div>
          ) : (
            folders.map(([folderName, folderNotes]) => {
              const isCollapsed = collapsedFolders[folderName];
              const visibleFolderNotes = folderNotes.filter((n) => filteredNotes.some((fn) => fn.id === n.id));

              if (visibleFolderNotes.length === 0 && (searchTerm || selectedTag)) {
                return null;
              }

              return (
                <div key={folderName} className="space-y-0.5">
                  <div
                    onClick={() => toggleFolder(folderName)}
                    className="flex items-center gap-2 py-1 px-1.5 text-text-secondary hover:text-text-primary cursor-pointer hover:bg-surface-variant rounded transition-colors"
                  >
                    {isCollapsed ? (
                      <Folder className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                    ) : (
                      <FolderOpen className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                    )}
                    <span className="font-medium truncate text-xs">{folderName}</span>
                  </div>

                  {!isCollapsed && (
                    <ul className="pl-4 flex flex-col gap-0.5 border-l border-outline-border/30 ml-2 mt-0.5">
                      {visibleFolderNotes.map((note) => {
                        const isSelected = currentNote?.id === note.id;
                        return (
                          <li
                            key={note.id}
                            onClick={() => {
                              onSelectNote(note);
                              setIsEditing(false);
                              setViewMode("preview");
                            }}
                            className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-all ${
                              isSelected
                                ? "text-primary bg-primary-container/10 border border-primary/20"
                                : "text-text-secondary hover:text-text-primary hover:bg-surface-variant"
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                            <span className="truncate font-body-sm text-xs">{note.title}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* COLUMN 2: MARKDOWN EDITOR (Center Column) */}
      <section className="flex-1 flex flex-col bg-background min-w-0">
        {currentNote ? (
          <>
            {/* Editor Header */}
            <div className="px-6 py-4 border-b border-outline-border shrink-0 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                
                {/* Breadcrumbs */}
                <div className="flex items-center gap-1.5 text-text-secondary font-body-sm text-xs">
                  {breadcrumbs.slice(0, -1).map((part, index) => (
                    <React.Fragment key={index}>
                      <span className="hover:text-primary cursor-pointer transition-colors truncate max-w-[120px]">
                        {part}
                      </span>
                      <ChevronRight className="w-3 h-3 text-text-secondary/70 shrink-0" />
                    </React.Fragment>
                  ))}
                  <span className="text-text-primary font-bold truncate max-w-[160px]">
                    {currentNote.title}
                  </span>
                </div>

                {/* Edit & Save Controls */}
                <div className="flex items-center gap-2">
                  {viewMode === "preview" ? (
                    <button
                      onClick={handleStartEdit}
                      className="px-3 py-1.5 rounded bg-surface-elevated border border-outline-border font-body-sm text-xs text-text-primary hover:bg-surface-variant transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                      <span>Editar</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1.5 rounded bg-primary-container text-white font-body-sm text-xs hover:bg-blue-600 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 text-white shrink-0" />
                      <span>Salvar</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Title & Static Meta */}
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight m-0">
                  {currentNote.title}
                </h1>
                
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span
                    className={`font-label-caps text-label-caps px-2 py-0.5 rounded border ${
                      currentNote.frontmatter?.status === "OFICIAL"
                        ? "bg-success-sober/10 border-success-sober/30 text-success-sober"
                        : currentNote.frontmatter?.status === "EM REVISÃO"
                        ? "bg-warning-sober/10 border-warning-sober/30 text-warning-sober"
                        : "bg-motor-info/10 border-motor-info/30 text-motor-info"
                    }`}
                  >
                    {currentNote.frontmatter?.status || "OFICIAL"}
                  </span>
                  {(currentNote.tags || []).map((t) => (
                    <span key={t} className="font-label-caps text-label-caps text-text-secondary bg-surface-elevated px-2 py-0.5 rounded border border-outline-border">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-outline-border/40 mt-1">
                <button
                  onClick={handleCopyMarkdown}
                  className="px-2.5 py-1 rounded bg-transparent border border-outline-border font-body-sm text-xs text-text-secondary hover:text-text-primary hover:border-outline transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedMarkdown ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{copiedMarkdown ? "Copiado!" : "Copiar MD"}</span>
                </button>

                <button
                  onClick={() => onExtractTasksFromNote(currentNote)}
                  disabled={isExtractingTasks}
                  className="px-2.5 py-1 rounded bg-transparent border border-outline-border font-body-sm text-xs text-text-secondary hover:text-text-primary hover:border-outline transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                  <span>{isExtractingTasks ? "Extraindo..." : "Extrair Tarefas"}</span>
                </button>

                <div className="h-4 w-px bg-outline-border/60 mx-1"></div>

                <a
                  href={buildObsidianOpenUri(apiConfig.vaultName, currentNote.path)}
                  className="px-2.5 py-1 rounded bg-purple-500/10 border border-purple-500/30 font-body-sm text-xs text-[#C4B5FD] hover:bg-purple-500/20 transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span>Abrir no Obsidian</span>
                </a>
              </div>
            </div>

            {/* Markdown Content Area / textarea editor */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              <div className="w-full">
                {viewMode === "edit" ? (
                  <div className="flex flex-col gap-3 h-full">
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="w-full h-[400px] p-4 bg-surface-container-low border border-outline-border rounded-xl font-mono text-xs text-text-primary leading-relaxed focus:outline-none focus:border-motor-info focus:ring-1 focus:ring-motor-info"
                    />
                    <div className="flex justify-end gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setViewMode("preview");
                        }}
                        className="px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-variant rounded-xl"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="px-4 py-2 bg-primary-container hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md"
                      >
                        Salvar Alterações
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none">
                    {renderMarkdown(currentNote.content || "")}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-surface-container border border-outline-border rounded-2xl flex items-center justify-center text-text-secondary opacity-70">
              <FolderOpen className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">Leitor de Notas Pronto</h3>
              <p className="text-xs text-text-secondary max-w-sm mx-auto mt-1 leading-relaxed">
                Nenhuma nota selecionada. Navegue no gerenciador lateral ou sincronize seu Obsidian Vault para explorar seu PKM de marketing.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* COLUMN 3: METADATA PANEL (Right Column) */}
      <aside className="hidden lg:flex w-72 border-l border-outline-border bg-surface-container flex-col shrink-0">
        <div className="p-4 border-b border-outline-border flex items-center justify-between shrink-0">
          <span className="font-headline-sm text-sm font-bold text-text-primary">Metadata</span>
          <button className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
            <ChevronsRight className="w-4 h-4 text-text-secondary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
          
          {/* Frontmatter Display */}
          <div>
            <h3 className="font-label-caps text-label-caps text-text-secondary mb-3">FRONTMATTER</h3>
            <div className="bg-[#0F172A] p-3 rounded-xl border border-outline-border font-code-mono text-xs text-text-secondary/90 flex flex-col gap-1.5">
              {currentNote?.frontmatter && Object.keys(currentNote.frontmatter).length > 0 ? (
                Object.entries(currentNote.frontmatter).map(([k, v]) => (
                  <div key={k} className="flex gap-1.5">
                    <span className="text-tertiary font-bold shrink-0">{k}:</span>
                    <span className="truncate">{String(v)}</span>
                  </div>
                ))
              ) : (
                <div className="text-text-secondary/50 font-mono italic text-[11px]">
                  Nenhum frontmatter YAML declarado.
                </div>
              )}
            </div>
          </div>

          {/* Connections / WikiLinks & BackLinks */}
          <div>
            <h3 className="font-label-caps text-label-caps text-text-secondary mb-3">CONNECTIONS</h3>
            <div className="flex flex-col gap-4">
              
              {/* Outgoing Wikilinks */}
              <div className="text-xs">
                <span className="text-text-secondary block mb-1.5 font-medium">Links de Saída (Wikilinks)</span>
                <div className="flex flex-wrap gap-1">
                  {outgoingLinks.length > 0 ? (
                    outgoingLinks.map((link, idx) => (
                      <span
                        key={idx}
                        onClick={() => handleWikilinkClick(link)}
                        className="wikilink inline-block px-1.5 py-0.5 rounded font-mono text-xs bg-purple-500/10 text-purple-200 border border-purple-500/20 cursor-pointer hover:bg-purple-500/20 active:scale-95 transition-all"
                      >
                        [[{link}]]
                      </span>
                    ))
                  ) : (
                    <span className="text-text-secondary/40 italic">Nenhum link de saída encontrado.</span>
                  )}
                </div>
              </div>

              {/* Backlinks */}
              <div className="text-xs">
                <span className="text-text-secondary block mb-1.5 font-medium">Backlinks (Mencionam esta nota)</span>
                <div className="flex flex-col gap-1">
                  {backlinks.length > 0 ? (
                    backlinks.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => {
                          onSelectNote(b);
                          setIsEditing(false);
                          setViewMode("preview");
                        }}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-surface-variant cursor-pointer border border-transparent hover:border-outline-border transition-colors text-xs"
                      >
                        <FileText className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                        <span className="text-primary truncate font-medium">{b.title}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-text-secondary/40 italic">Nenhum backlink para esta nota.</span>
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>
      </aside>

    </div>
  );
};

