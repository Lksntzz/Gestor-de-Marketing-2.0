import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, FileText, Loader2, X } from "lucide-react";
import { ObsidianApiConfig, ObsidianNote } from "../types";
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

export const NoteModal: React.FC<NoteModalProps> = ({
  isOpen,
  onClose,
  onSaveNote,
  existingFolders,
}) => {
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("00_Inbox");
  const [customFolder, setCustomFolder] = useState("");
  const [tagsInput, setTagsInput] = useState("estrategia, marketing");
  const [content, setContent] = useState(
    `# Título da Nota\n\n## 1. Visão Geral\nDescreva a estratégia ou briefing aqui.\n\n## 2. Tarefas Relacionadas\n- [ ] Definir KPIs 2026-08-30 10:00 #marketing\n`
  );
  const [vaultFolders, setVaultFolders] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    if (!api.isObsidianSessionVerified()) {
      setVaultFolders([]);
      return;
    }

    void (async () => {
      try {
        const folders = window.electronAPI ? await window.electronAPI.listVaultFolders() : existingFolders;
        setVaultFolders(Array.isArray(folders) ? folders : []);
      } catch {
        setVaultFolders(existingFolders);
      }
    })();
  }, [isOpen, existingFolders]);

  const availableFolders = useMemo(
    () => Array.from(new Set([...vaultFolders, ...existingFolders].filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [vaultFolders, existingFolders]
  );

  useEffect(() => {
    if (!isOpen) return;
    if (folder !== "OUTRA" && availableFolders.length > 0 && !availableFolders.includes(folder)) {
      setFolder(availableFolders[0]);
    }
  }, [availableFolders, folder, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!api.isObsidianSessionVerified()) {
      setError("Obsidian desconectado. Conecte e sincronize o Vault antes de criar uma nota.");
      return;
    }

    const finalFolder = folder === "OUTRA" ? (customFolder.trim() || "00_Inbox") : folder;
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    const notePath = `${finalFolder}/${cleanTitle}.md`;
    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter(Boolean);

    const fullContent = `---
title: "${cleanTitle}"
tags:
${tags.map((tag) => `  - ${tag}`).join("\n")}
category: "${finalFolder}"
last_reviewed: "${new Date().toISOString().split("T")[0]}"
---

${content}`;

    const parsed = parseMarkdownNote(fullContent);
    const newNote: ObsidianNote = {
      id: `note-${Date.now()}`,
      path: notePath,
      title: cleanTitle,
      folder: finalFolder,
      content: fullContent,
      frontmatter: parsed.frontmatter,
      tags: Array.from(new Set([...tags, ...parsed.tags])),
      wikilinks: parsed.wikilinks,
      lastModified: new Date().toISOString().replace("T", " ").slice(0, 16),
      syncedWithApi: true,
    };

    setIsSaving(true);
    try {
      const config = await storage.loadApiConfig(DEFAULT_CONFIG);
      const result = await api.pushNoteToObsidian(config, notePath, fullContent, parsed.frontmatter);
      if (!result?.success) {
        setError(result?.message || "O Obsidian não confirmou a gravação. A nota não foi salva.");
        return;
      }

      onSaveNote(newNote);
      onClose();
    } catch (err: any) {
      setError(err.message || "Falha ao gravar a nota no Vault do Obsidian.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">Nova Nota no Cofre Obsidian</h2>
              <p className="text-xs text-stone-500">A gravação só é liberada com conexão ativa e Vault sincronizado.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {!api.isObsidianSessionVerified() && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Banco de conhecimento indisponível. Conecte o Obsidian em Configuração antes de salvar.</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Título da Nota</label>
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
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Pasta no Cofre</label>
              <select
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-purple-500"
              >
                {availableFolders.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
                {availableFolders.length === 0 && <option value="00_Inbox">00_Inbox</option>}
                <option value="OUTRA">+ Criar Nova Pasta...</option>
              </select>
            </div>

            {folder === "OUTRA" ? (
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Nome da Nova Pasta</label>
                <input
                  type="text"
                  required
                  value={customFolder}
                  onChange={(e) => setCustomFolder(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-purple-500"
                  placeholder="07_Relatorios/Campanhas"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Tags (separadas por vírgula)</label>
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
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Conteúdo Markdown</label>
            <textarea
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-3 bg-stone-50 border border-stone-300 rounded-lg text-xs font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-800">Cancelar</button>
            <button
              type="submit"
              disabled={isSaving || !api.isObsidianSessionVerified()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isSaving ? "Salvando no Obsidian..." : "Criar Nota no Obsidian"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
