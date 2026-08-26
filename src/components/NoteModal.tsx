import React, { useState } from "react";
import { X, FileText, FolderPlus, Tag } from "lucide-react";
import { ObsidianNote } from "../types";
import { parseMarkdownNote } from "../utils/obsidianUri";

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveNote: (note: ObsidianNote) => void;
  existingFolders: string[];
}

export const NoteModal: React.FC<NoteModalProps> = ({
  isOpen,
  onClose,
  onSaveNote,
  existingFolders,
}) => {
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("00 - Estratégia");
  const [customFolder, setCustomFolder] = useState("");
  const [tagsInput, setTagsInput] = useState("estrategia, marketing");
  const [content, setContent] = useState(
    `# Título da Nota\n\n## 1. Visão Geral\nDescreva a estratégia ou briefing aqui.\n\n## 2. Tarefas Relacionadas\n- [ ] Definir KPIs 2026-08-30 10:00 #marketing\n`
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalFolder = folder === "OUTRA" ? (customFolder.trim() || "Geral") : folder;
    const cleanTitle = title.trim();
    const path = `${finalFolder}/${cleanTitle}.md`;

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);

    const fullContent = `---
title: "${cleanTitle}"
tags:
${tags.map((t) => `  - ${t}`).join("\n")}
category: "${finalFolder}"
last_reviewed: "${new Date().toISOString().split("T")[0]}"
---

${content}`;

    const parsed = parseMarkdownNote(fullContent);

    const newNote: ObsidianNote = {
      id: `note-${Date.now()}`,
      path,
      title: cleanTitle,
      folder: finalFolder,
      content: fullContent,
      frontmatter: parsed.frontmatter,
      tags: Array.from(new Set([...tags, ...parsed.tags])),
      wikilinks: parsed.wikilinks,
      lastModified: new Date().toISOString().replace("T", " ").slice(0, 16),
      syncedWithApi: false,
    };

    onSaveNote(newNote);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">Nova Nota no Cofre Obsidian</h2>
              <p className="text-xs text-stone-500">
                Criará um documento Markdown (.md) com frontmatter YAML e tags
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Título da Nota
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-purple-500 font-medium"
              placeholder="Ex: Persona - Gerente de E-commerce"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Pasta no Cofre
              </label>
              <select
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-purple-500"
              >
                {existingFolders.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
                <option value="OUTRA">+ Criar Nova Pasta...</option>
              </select>
            </div>

            {folder === "OUTRA" ? (
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Nome da Nova Pasta
                </label>
                <input
                  type="text"
                  required
                  value={customFolder}
                  onChange={(e) => setCustomFolder(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-purple-500"
                  placeholder="07 - Relatórios"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Tags (separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-purple-500"
                  placeholder="persona, b2b, growth"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Conteúdo Markdown
            </label>
            <textarea
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-3 bg-stone-50 border border-stone-300 rounded-lg text-xs font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              Criar Nota
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
