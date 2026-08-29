import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { CreativeScript, EditorialItem, MarketingTask, TaskPriority } from "../types";
import { consumeEditorialPlanningHandoff } from "../services/editorialPlanningHandoff";
import { localDateKey } from "../utils/reliability";
import {
  approvedScriptToEditorialDraft,
  createEmptyEditorialDraft,
  editorialItemToDraft,
  finalizeEditorialDraft,
  reconcileEditorialTask,
  removeEditorialTask,
  type EditorialDraft,
} from "../utils/editorialWorkflow";

interface EditorialCalendarViewProps {
  tasks: MarketingTask[];
  onTasksChange: (tasks: MarketingTask[]) => void;
  scripts?: CreativeScript[];
  [legacyProp: string]: unknown;
}

const PRIORITY_LABELS: Array<{ value: TaskPriority; label: string }> = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const STATUS_LABELS: Record<EditorialItem["status"], string> = {
  DRAFT: "Rascunho",
  IN_PRODUCTION: "Em produção",
  REVIEW: "Revisão",
  APPROVED: "Aprovado",
  SCHEDULED: "Agendado",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
};

function mondayOf(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  result.setDate(result.getDate() - day + (day === 0 ? -6 : 1));
  return result;
}

function isWorkflowApproved(script: CreativeScript): boolean {
  return script.tags.some((tag) => tag.trim().toLowerCase() === "workflow:approved");
}

export const EditorialCalendarView: React.FC<EditorialCalendarViewProps> = ({
  tasks,
  onTasksChange,
  scripts = [],
}) => {
  const [items, setItems] = useState<EditorialItem[]>([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [editorDraft, setEditorDraft] = useState<EditorialDraft | null>(null);
  const [editorError, setEditorError] = useState("");
  const [isSavingItem, setIsSavingItem] = useState(false);

  const loadItems = useCallback(async () => {
    if (!window.electronAPI?.editorialList) {
      setItems([]);
      setItemsLoaded(true);
      return;
    }
    try {
      const dbItems = await window.electronAPI.editorialList();
      setItems(Array.isArray(dbItems) ? dbItems : []);
    } catch (error) {
      console.error("Failed to load editorial calendar:", error);
      setItems([]);
    } finally {
      setItemsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!itemsLoaded) return;

    const handoff = consumeEditorialPlanningHandoff();
    if (!handoff) return;

    const existing = items.find(
      (item) => item.scriptId === handoff.scriptId && item.status !== "ARCHIVED",
    );
    if (existing) {
      setEditorError("");
      setEditorDraft(editorialItemToDraft(existing));
      return;
    }

    const script = scripts.find(
      (candidate) => candidate.id === handoff.scriptId && isWorkflowApproved(candidate),
    );
    if (!script) {
      console.warn("Planning handoff ignored because the approved script no longer exists.", handoff.scriptId);
      return;
    }

    const draft = approvedScriptToEditorialDraft(script, `ed-${Date.now()}`);
    setEditorError("");
    setEditorDraft({
      ...draft,
      scheduledDate: handoff.scheduledDate || draft.scheduledDate,
      scheduledTime: handoff.scheduledTime || draft.scheduledTime,
    });
  }, [itemsLoaded, items, scripts]);

  const daysOfWeek = useMemo(
    () => Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + index);
      return date;
    }),
    [currentWeekStart],
  );

  const approvedWaiting = useMemo(() => {
    const activeScriptIds = new Set(
      items
        .filter((item) => item.status !== "ARCHIVED" && item.scriptId)
        .map((item) => item.scriptId as string),
    );
    return scripts.filter((script) => isWorkflowApproved(script) && !activeScriptIds.has(script.id));
  }, [items, scripts]);

  const isExistingDraft = useMemo(
    () => Boolean(editorDraft && items.some((item) => item.id === editorDraft.id)),
    [editorDraft, items],
  );

  const changeWeek = (offset: number) => {
    setCurrentWeekStart((current) => {
      const date = new Date(current);
      date.setDate(date.getDate() + offset * 7);
      return date;
    });
  };

  const openManualItem = () => {
    setEditorError("");
    setEditorDraft(createEmptyEditorialDraft(`ed-${Date.now()}`));
  };

  const openApprovedScript = (script: CreativeScript) => {
    setEditorError("");
    setEditorDraft(approvedScriptToEditorialDraft(script, `ed-${Date.now()}`));
  };

  const openExistingItem = (item: EditorialItem) => {
    setEditorError("");
    setEditorDraft(editorialItemToDraft(item));
  };

  const handleSaveItem = async () => {
    if (!editorDraft || isSavingItem) return;
    setEditorError("");
    setIsSavingItem(true);

    try {
      const item = finalizeEditorialDraft(editorDraft);
      if (!window.electronAPI?.editorialUpsert) {
        throw new Error("O calendário editorial exige o runtime desktop para persistir alterações.");
      }

      const result = await window.electronAPI.editorialUpsert(item);
      if (!result?.success) throw new Error("O banco editorial não confirmou a gravação.");

      onTasksChange(reconcileEditorialTask(tasks, item));
      setEditorDraft(null);
      await loadItems();
    } catch (error: any) {
      setEditorError(error?.message || "Não foi possível salvar o conteúdo editorial.");
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!editorDraft || isSavingItem || !isExistingDraft) return;
    if (!window.confirm(`Excluir “${editorDraft.title || "este conteúdo"}” do calendário?`)) return;

    setEditorError("");
    setIsSavingItem(true);
    try {
      if (!window.electronAPI?.editorialDelete) {
        throw new Error("O calendário editorial exige o runtime desktop para excluir conteúdo.");
      }
      const result = await window.electronAPI.editorialDelete(editorDraft.id);
      if (!result?.success) throw new Error("O banco editorial não confirmou a exclusão.");

      onTasksChange(removeEditorialTask(tasks, editorDraft.id));
      setEditorDraft(null);
      await loadItems();
    } catch (error: any) {
      setEditorError(error?.message || "Não foi possível excluir o conteúdo editorial.");
    } finally {
      setIsSavingItem(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-[#0B0D1B] overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="px-4 sm:px-6 lg:px-8 py-5 border-b border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0 bg-[#0B0D1B] z-10">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Calendar className="w-6 h-6 text-pink-500" /> Planejar
            </h1>
            <p className="text-sm text-stone-400 mt-1">
              Calendário semanal para conteúdos aprovados e decisões manuais de publicação.
            </p>
          </div>
          <button
            type="button"
            onClick={openManualItem}
            className="self-start md:self-auto bg-white/5 hover:bg-white/10 text-stone-300 border border-white/10 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> Item manual
          </button>
        </header>

        <div className="flex-1 px-4 sm:px-6 lg:px-8 py-5 overflow-y-auto">
          <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white">Aprovados aguardando data</h2>
                <p className="mt-1 text-[11px] text-stone-500">
                  Vêm de Criar. Nada recebe data, horário ou prioridade automaticamente.
                </p>
              </div>
              <span className="text-[10px] font-bold text-stone-400 border border-white/10 rounded-lg px-2.5 py-1.5">
                {approvedWaiting.length} aguardando
              </span>
            </div>

            {approvedWaiting.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-xs text-stone-500">
                Nenhum conteúdo aprovado aguardando planejamento.
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-3">
                {approvedWaiting.map((script) => (
                  <article key={script.id} className="rounded-xl border border-white/10 bg-black/20 p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white truncate">{script.title}</h3>
                      <p className="mt-1 text-[10px] text-stone-500">
                        {[script.platform, script.format, script.objective].filter(Boolean).join(" • ") || "Metadados incompletos"}
                      </p>
                      {script.sourceIdeaTitle && (
                        <p className="mt-2 text-[10px] text-stone-600">Origem: {script.sourceIdeaTitle}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openApprovedScript(script)}
                      className="shrink-0 px-3 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold"
                    >
                      Escolher data
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <button onClick={() => changeWeek(-1)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white" aria-label="Semana anterior">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-lg font-bold text-white capitalize">
                Semana de {currentWeekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
              </h2>
              <button onClick={() => changeWeek(1)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white" aria-label="Próxima semana">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto pb-3">
            <div className="grid grid-cols-7 gap-4 min-w-[980px]">
              {daysOfWeek.map((day) => {
                const dateKey = localDateKey(day);
                const dayItems = items.filter((item) => item.scheduledDate === dateKey && item.status !== "ARCHIVED");
                const isToday = dateKey === localDateKey();

                return (
                  <div key={dateKey} className={`flex flex-col bg-black/20 border ${isToday ? "border-pink-500/50" : "border-white/5"} rounded-2xl overflow-hidden min-h-[360px]`}>
                    <div className={`p-3 text-center border-b ${isToday ? "border-pink-500/30 bg-pink-500/10" : "border-white/5 bg-black/40"}`}>
                      <div className={`text-xs font-bold uppercase mb-1 ${isToday ? "text-pink-400" : "text-stone-500"}`}>
                        {day.toLocaleDateString("pt-BR", { weekday: "short" })}
                      </div>
                      <div className={`text-xl font-bold ${isToday ? "text-white" : "text-stone-300"}`}>{day.getDate()}</div>
                    </div>
                    <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                      {dayItems.length === 0 ? (
                        <div className="text-center text-[10px] text-stone-600 py-4 font-medium uppercase tracking-wider">Livre</div>
                      ) : dayItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openExistingItem(item)}
                          className="w-full text-left bg-white/5 border border-white/10 p-3 rounded-xl hover:bg-white/10 transition-colors"
                        >
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-black/30 text-stone-400">
                              {item.scheduledTime || "Sem horário"}
                            </span>
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              item.status === "PUBLISHED" ? "bg-emerald-500/20 text-emerald-400" :
                              item.status === "SCHEDULED" ? "bg-blue-500/20 text-blue-400" :
                              item.status === "DRAFT" ? "bg-white/10 text-stone-400" :
                              "bg-amber-500/20 text-amber-400"
                            }`}>
                              {STATUS_LABELS[item.status]}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-white mb-1 leading-snug line-clamp-2">{item.title}</h4>
                          <div className="flex flex-wrap gap-1 mt-2">
                            <span className="text-[9px] text-stone-400 bg-black/30 px-1.5 py-0.5 rounded border border-white/5">{item.platform}</span>
                            <span className="text-[9px] text-stone-400 bg-black/30 px-1.5 py-0.5 rounded border border-white/5">{item.contentType}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {editorDraft && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111322] border border-white/10 rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Planejar conteúdo</h2>
                <p className="text-xs text-stone-500 mt-1">
                  Confirme data e prioridade. Campos vindos de Criar podem ser revisados antes de salvar.
                </p>
              </div>
              <button onClick={() => setEditorDraft(null)} className="p-2 text-stone-500 hover:text-white" aria-label="Fechar">
                <X className="w-5 h-5" />
              </button>
            </div>

            {editorDraft.scriptId && (
              <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
                Conteúdo aprovado em Criar. O vínculo com o roteiro será preservado no calendário.
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Título</label>
                <input value={editorDraft.title} onChange={(event) => setEditorDraft({ ...editorDraft, title: event.target.value })} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white" placeholder="Título do conteúdo" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Data *</label>
                  <input type="date" value={editorDraft.scheduledDate} onChange={(event) => setEditorDraft({ ...editorDraft, scheduledDate: event.target.value })} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Hora opcional</label>
                  <input type="time" value={editorDraft.scheduledTime} onChange={(event) => setEditorDraft({ ...editorDraft, scheduledTime: event.target.value })} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white [color-scheme:dark]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Plataforma</label>
                  <input value={editorDraft.platform} onChange={(event) => setEditorDraft({ ...editorDraft, platform: event.target.value })} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white" placeholder="Canal/plataforma" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Formato</label>
                  <input value={editorDraft.contentType} onChange={(event) => setEditorDraft({ ...editorDraft, contentType: event.target.value })} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white" placeholder="Formato" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Objetivo</label>
                <input value={editorDraft.objective} onChange={(event) => setEditorDraft({ ...editorDraft, objective: event.target.value })} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white" placeholder="Objetivo real deste conteúdo" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Prioridade *</label>
                  <select value={editorDraft.priority} onChange={(event) => setEditorDraft({ ...editorDraft, priority: event.target.value as TaskPriority | "" })} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white">
                    <option value="">Selecione</option>
                    {PRIORITY_LABELS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Status</label>
                  <select value={editorDraft.status} onChange={(event) => setEditorDraft({ ...editorDraft, status: event.target.value as EditorialItem["status"] })} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white">
                    <option value="DRAFT">Rascunho</option>
                    <option value="IN_PRODUCTION">Em produção</option>
                    <option value="REVIEW">Revisão</option>
                    <option value="APPROVED">Aprovado</option>
                    <option value="SCHEDULED">Agendado</option>
                    <option value="PUBLISHED">Publicado</option>
                    <option value="ARCHIVED">Arquivado</option>
                  </select>
                </div>
              </div>
            </div>

            {editorError && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {editorError}
              </div>
            )}

            <div className="flex justify-between items-center mt-8">
              {isExistingDraft ? (
                <button disabled={isSavingItem} onClick={handleDeleteItem} className="text-sm font-bold text-red-500 hover:text-red-400 transition-colors flex items-center gap-2 disabled:opacity-50">
                  <Trash2 className="w-4 h-4" /> Excluir
                </button>
              ) : <span />}
              <div className="flex gap-3">
                <button onClick={() => setEditorDraft(null)} className="bg-white/5 hover:bg-white/10 text-white rounded-xl px-4 py-2 font-bold text-sm transition-colors">Cancelar</button>
                <button disabled={isSavingItem} onClick={handleSaveItem} className="bg-pink-600 hover:bg-pink-500 text-white rounded-xl px-4 py-2 font-bold text-sm transition-colors flex items-center gap-2 disabled:opacity-50">
                  {isSavingItem ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Salvar no calendário
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};