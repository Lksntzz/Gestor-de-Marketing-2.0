import React, { useState } from "react";
import { Bell, CheckSquare, X } from "lucide-react";
import type { MarketingTask, ObsidianNote, TaskPriority } from "../types";
import { formatToObsidianTask } from "../utils/obsidianUri";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTask: (task: MarketingTask) => void;
  notes: ObsidianNote[];
}

export const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSaveTask, notes }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [channel, setChannel] = useState("");
  const [priority, setPriority] = useState<TaskPriority | "">("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [isReminderActive, setIsReminderActive] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [selectedNotePath, setSelectedNotePath] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [validationError, setValidationError] = useState("");

  if (!isOpen) return null;

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setChannel("");
    setPriority("");
    setDueDate("");
    setDueTime("");
    setIsReminderActive(false);
    setReminderDate("");
    setReminderTime("");
    setSelectedNotePath("");
    setTagsInput("");
    setValidationError("");
  };

  const closeModal = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !priority) {
      setValidationError("Título e prioridade precisam ser definidos explicitamente.");
      return;
    }
    if (isReminderActive && (!reminderDate || !reminderTime)) {
      setValidationError("Defina data e horário do lembrete ou desative o lembrete.");
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter(Boolean);

    const task: MarketingTask = {
      id: `task-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || undefined,
      channel: channel.trim() || undefined,
      priority,
      status: "todo",
      dueDate,
      dueTime: dueTime || undefined,
      reminderDate: isReminderActive ? reminderDate : undefined,
      reminderTime: isReminderActive ? reminderTime : undefined,
      obsidianTaskString: formatToObsidianTask({
        title: title.trim(),
        status: "todo",
        dueDate: dueDate || undefined,
        dueTime: dueTime || undefined,
        reminderDate: isReminderActive ? reminderDate : undefined,
        reminderTime: isReminderActive ? reminderTime : undefined,
        priority,
        tags,
      }),
      obsidianFilePath: selectedNotePath || undefined,
      tags,
      isReminderActive,
    };

    onSaveTask(task);
    resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-xl max-h-[90vh] overflow-hidden rounded-2xl border border-outline-border bg-surface-card shadow-2xl flex flex-col font-sans">
        <div className="shrink-0 px-5 py-4 border-b border-outline-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl border border-primary-container/30 bg-primary-container/10 text-primary-fixed-dim flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-text-primary">Nova tarefa</h2>
              <p className="text-[11px] text-text-secondary">Nenhum prazo, canal, prioridade ou lembrete é preenchido automaticamente.</p>
            </div>
          </div>
          <button type="button" onClick={closeModal} className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {validationError && (
            <div className="rounded-xl border border-error-sober/30 bg-error-sober/10 px-3 py-2 text-xs text-error-sober">
              {validationError}
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-text-secondary mb-1.5">Título *</label>
            <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Descreva a ação real a executar" className="w-full px-3 py-2.5 rounded-xl border border-outline-border bg-surface-elevated/40 text-xs text-text-primary outline-none focus:border-primary-container" />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-text-secondary mb-1.5">Contexto</label>
            <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Opcional: evidência, dependência ou resultado esperado" className="w-full px-3 py-2.5 rounded-xl border border-outline-border bg-surface-elevated/40 text-xs text-text-primary outline-none focus:border-primary-container resize-none" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-text-secondary mb-1.5">Prioridade *</label>
              <select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority | "")} className="w-full px-3 py-2.5 rounded-xl border border-outline-border bg-surface-elevated/40 text-xs text-text-primary outline-none">
                <option value="">Selecionar</option>
                <option value="urgent">Urgente</option>
                <option value="high">Alta</option>
                <option value="medium">Média</option>
                <option value="low">Baixa</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-text-secondary mb-1.5">Canal</label>
              <input value={channel} onChange={(event) => setChannel(event.target.value)} placeholder="Opcional" className="w-full px-3 py-2.5 rounded-xl border border-outline-border bg-surface-elevated/40 text-xs text-text-primary outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-text-secondary mb-1.5">Prazo</label>
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-outline-border bg-surface-elevated/40 text-xs text-text-primary outline-none" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-text-secondary mb-1.5">Horário</label>
              <input type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} disabled={!dueDate} className="w-full px-3 py-2.5 rounded-xl border border-outline-border bg-surface-elevated/40 text-xs text-text-primary outline-none disabled:opacity-40" />
            </div>
          </div>

          <div className="rounded-xl border border-outline-border bg-surface-elevated/30 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-text-primary"><Bell className="w-3.5 h-3.5" /> Lembrete</div>
                <p className="mt-1 text-[11px] text-text-secondary">Só é criado quando você define data e hora explicitamente.</p>
              </div>
              <input type="checkbox" checked={isReminderActive} onChange={(event) => setIsReminderActive(event.target.checked)} />
            </div>
            {isReminderActive && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <input type="date" value={reminderDate} onChange={(event) => setReminderDate(event.target.value)} className="px-3 py-2 rounded-lg border border-outline-border bg-surface-card text-xs text-text-primary" />
                <input type="time" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} className="px-3 py-2 rounded-lg border border-outline-border bg-surface-card text-xs text-text-primary" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-text-secondary mb-1.5">Fonte no Obsidian</label>
            <select value={selectedNotePath} onChange={(event) => setSelectedNotePath(event.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-outline-border bg-surface-elevated/40 text-xs text-text-primary outline-none">
              <option value="">Sem nota vinculada</option>
              {notes.map((note) => <option key={note.id} value={note.path}>{note.path}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-text-secondary mb-1.5">Tags</label>
            <input value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} placeholder="Separadas por vírgula" className="w-full px-3 py-2.5 rounded-xl border border-outline-border bg-surface-elevated/40 text-xs text-text-primary outline-none" />
          </div>

          <div className="pt-3 border-t border-outline-border flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="px-4 py-2 rounded-xl border border-outline-border text-xs font-semibold text-text-primary">Cancelar</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-primary-container text-white text-xs font-bold">Registrar tarefa</button>
          </div>
        </form>
      </div>
    </div>
  );
};
