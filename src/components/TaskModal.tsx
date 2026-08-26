import React, { useState } from "react";
import { X, CheckSquare, Clock, Calendar, Tag, FileText } from "lucide-react";
import { MarketingTask, TaskPriority, ObsidianNote } from "../types";
import { formatToObsidianTask } from "../utils/obsidianUri";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTask: (task: MarketingTask) => void;
  notes: ObsidianNote[];
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSaveTask,
  notes,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [channel, setChannel] = useState("LinkedIn");
  const [priority, setPriority] = useState<TaskPriority>("high");
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0]
  );
  const [dueTime, setDueTime] = useState("14:00");
  const [isReminderActive, setIsReminderActive] = useState(true);
  const [reminderDate, setReminderDate] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0]
  );
  const [reminderTime, setReminderTime] = useState("11:30");
  const [selectedNotePath, setSelectedNotePath] = useState("Daily Notes/2026-08-25.md");
  const [tagsInput, setTagsInput] = useState("marketing, automacao");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);

    const taskObj: MarketingTask = {
      id: `task-${Date.now()}`,
      title,
      description,
      channel,
      priority,
      status: "todo",
      dueDate,
      dueTime,
      reminderDate: isReminderActive ? reminderDate : undefined,
      reminderTime: isReminderActive ? reminderTime : undefined,
      obsidianTaskString: formatToObsidianTask({
        title,
        status: "todo",
        dueDate,
        dueTime,
        reminderDate: isReminderActive ? reminderDate : undefined,
        reminderTime: isReminderActive ? reminderTime : undefined,
        priority,
        tags,
      }),
      obsidianFilePath: selectedNotePath,
      tags,
      isReminderActive,
    };

    onSaveTask(taskObj);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">Nova Tarefa Obsidian</h2>
              <p className="text-xs text-stone-500">
                Formatação automática com sintaxe de Tasks e Reminder
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

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Título da Tarefa
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-purple-500 font-medium"
              placeholder="Ex: Disparar sequência de emails de onboarding"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Detalhes / Contexto
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-purple-500"
              placeholder="Ex: Validar links e tags das personas antes do envio"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Canal
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-purple-500"
              >
                <option value="LinkedIn">LinkedIn</option>
                <option value="Email">Email Marketing</option>
                <option value="Blog">Blog SEO</option>
                <option value="Instagram">Instagram</option>
                <option value="Twitter">Twitter / X</option>
                <option value="Automação">Automação</option>
                <option value="Geral">Geral</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Prioridade
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-purple-500 font-semibold"
              >
                <option value="urgent">Urgente (Alta Prioridade)</option>
                <option value="high">Alta</option>
                <option value="medium">Média</option>
                <option value="low">Baixa</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Data Limite (Due Date)
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-purple-500"
              >
              </input>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Horário Limite
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Reminder Switch */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Ativar Alarme (Obsidian Reminder Plugin)</span>
              </span>
              <input
                type="checkbox"
                checked={isReminderActive}
                onChange={(e) => setIsReminderActive(e.target.checked)}
                className="rounded text-purple-600 focus:ring-purple-500"
              />
            </div>

            {isReminderActive && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-amber-800 uppercase mb-1">
                    Data do Alarme
                  </label>
                  <input
                    type="date"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-amber-800 uppercase mb-1">
                    Horário do Alarme
                  </label>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Nota do Obsidian Vinculada
            </label>
            <select
              value={selectedNotePath}
              onChange={(e) => setSelectedNotePath(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-purple-500"
            >
              {notes.map((n) => (
                <option key={n.id} value={n.path}>
                  {n.path}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Tags (separadas por vírgula)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-purple-500"
              placeholder="marketing, linkedin, q3"
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
              Criar Tarefa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
