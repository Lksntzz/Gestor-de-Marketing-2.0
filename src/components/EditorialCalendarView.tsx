import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { EditorialItem, MarketingTask, TaskPriority } from "../types";
import { generateEditorialPlanSuggestions } from "../services/editorialPlanningApi";
import { localDateKey } from "../utils/reliability";
import {
  createEmptyEditorialDraft,
  editorialItemToDraft,
  finalizeEditorialDraft,
  normalizeWeeklyPlanSuggestions,
  reconcileEditorialTask,
  removeEditorialTask,
  suggestionToDraft,
  type EditorialDraft,
  type EditorialPlanSuggestion,
} from "../utils/editorialWorkflow";

interface EditorialCalendarViewProps {
  tasks: MarketingTask[];
  onTasksChange: (tasks: MarketingTask[]) => void;
  engineMode?: string;
  [legacyProp: string]: unknown;
}

function splitValues(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function endOfWeekKey(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  return localDateKey(end);
}

const PRIORITY_LABELS: Array<{ value: TaskPriority; label: string }> = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

export const EditorialCalendarView: React.FC<EditorialCalendarViewProps> = ({
  tasks,
  onTasksChange,
  engineMode: engineModeProp,
}) => {
  const engineMode = engineModeProp
    || (typeof window !== "undefined" ? window.localStorage.getItem("obsidian_engine_mode") : null)
    || "local";

  const [items, setItems] = useState<EditorialItem[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    return date;
  });

  const [editorDraft, setEditorDraft] = useState<EditorialDraft | null>(null);
  const [editorError, setEditorError] = useState("");
  const [isSavingItem, setIsSavingItem] = useState(false);

  const [isPlanning, setIsPlanning] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planCount, setPlanCount] = useState("3");
  const [planPlatforms, setPlanPlatforms] = useState("");
  const [planFormats, setPlanFormats] = useState("");
  const [planObjectives, setPlanObjectives] = useState("");
  const [planInstructions, setPlanInstructions] = useState("");
  const [planSuggestions, setPlanSuggestions] = useState<EditorialPlanSuggestion[]>([]);
  const [planError, setPlanError] = useState("");
  const [planWarning, setPlanWarning] = useState("");

  const loadItems = useCallback(async () => {
    if (!window.electronAPI?.editorialList) {
      setItems([]);
      return;
    }
    try {
      const dbItems = await window.electronAPI.editorialList();
      setItems(Array.isArray(dbItems) ? dbItems : []);
    } catch (error) {
      console.error("Failed to load editorial calendar:", error);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const daysOfWeek = useMemo(
    () => Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + index);
      return date;
    }),
    [currentWeekStart],
  );

  const changeWeek = (offset: number) => {
    setCurrentWeekStart((current) => {
      const date = new Date(current);
      date.setDate(date.getDate() + offset * 7);
      return date;
    });
  };

  const openNewItem = () => {
    setEditorError("");
    setEditorDraft(createEmptyEditorialDraft(`ed-${Date.now()}`));
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
    if (!editorDraft || isSavingItem) return;
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

  const handlePlanWeek = async () => {
    if (isGeneratingPlan) return;
    setPlanError("");
    setPlanWarning("");
    setPlanSuggestions([]);

    const count = Number.parseInt(planCount, 10);
    const platforms = splitValues(planPlatforms);
    const formats = splitValues(planFormats);
    const objectives = splitValues(planObjectives);

    if (!Number.isInteger(count) || count < 1 || count > 14) {
      setPlanError("Informe uma quantidade entre 1 e 14 sugestões.");
      return;
    }
    if (platforms.length === 0 || formats.length === 0 || objectives.length === 0) {
      setPlanError("Informe pelo menos uma plataforma, um formato e um objetivo antes de gerar sugestões.");
      return;
    }

    setIsGeneratingPlan(true);
    try {
      const weekStart = localDateKey(currentWeekStart);
      const weekEnd = endOfWeekKey(currentWeekStart);
      const existingItems = items
        .filter((item) => item.scheduledDate >= weekStart && item.scheduledDate <= weekEnd)
        .map((item) => ({
          title: item.title,
          date: item.scheduledDate,
          time: item.scheduledTime,
          platform: item.platform,
          format: item.contentType,
          objective: item.objective,
        }));

      const res = await generateEditorialPlanSuggestions({
        weekStart,
        count,
        platforms,
        formats,
        objectives,
        customInstructions: planInstructions.trim(),
        existingItems,
        engineMode,
      });

      const suggestions = normalizeWeeklyPlanSuggestions(res?.data, weekStart);
      setPlanSuggestions(suggestions);
      setPlanWarning(
        String(res?.contextWarning || res?.warning || (res?.wasFallback
          ? "O provedor falhou e nenhuma agenda foi aplicada automaticamente. Revise as sugestões disponíveis."
          : "")),
      );

      if (suggestions.length === 0) {
        setPlanError(
          engineMode === "local"
            ? "O modo local não cria uma agenda editorial artificial. Ative um provedor de IA para receber sugestões fundamentadas."
            : "Nenhuma sugestão válida foi retornada para a semana. Nenhum item foi salvo.",
        );
      }
    } catch (error: any) {
      setPlanError(error?.message || "Não foi possível gerar sugestões para a semana.");
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const reviewSuggestion = (suggestion: EditorialPlanSuggestion, index: number) => {
    setEditorError("");
    setEditorDraft(suggestionToDraft(suggestion, `ed-${Date.now()}-${index}`));
    setIsPlanning(false);
  };

  return (
    <div className="flex h-full min-h-0 bg-[#0B0D1B] overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="px-8 py-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#0B0D1B] z-10">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Calendar className="w-6 h-6 text-pink-500" /> Planejar
            </h1>
            <p className="text-sm text-stone-400 mt-1">Calendário semanal de conteúdos confirmados por você.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setPlanError("");
                setPlanWarning("");
                setPlanSuggestions([]);
                setIsPlanning(true);
              }}
              className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-600/30 transition-colors"
            >
              <Sparkles className="w-4 h-4" /> Gerar sugestões
            </button>
            <button
              onClick={openNewItem}
              className="bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" /> Novo conteúdo
            </button>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
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

          <div className="grid grid-cols-7 gap-4 min-w-[980px]">
            {daysOfWeek.map((day) => {
              const dateKey = localDateKey(day);
              const dayItems = items.filter((item) => item.scheduledDate === dateKey);
              const isToday = dateKey === localDateKey();

              return (
                <div key={dateKey} className={`flex flex-col bg-black/20 border ${isToday ? "border-pink-500/50" : "border-white/5"} rounded-2xl overflow-hidden min-h-[400px]`}>
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
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-black/30 text-stone-400">
                            {item.scheduledTime || "Sem horário"}
                          </span>
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            item.status === "PUBLISHED" ? "bg-emerald-500/20 text-emerald-400" :
                            item.status === "SCHEDULED" ? "bg-blue-500/20 text-blue-400" :
                            item.status === "DRAFT" ? "bg-white/10 text-stone-400" :
                            "bg-amber-500/20 text-amber-400"
                          }`}>
                            {item.status}
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

      {isPlanning && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111322] border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-pink-500" /> Sugestões para a semana
                </h2>
                <p className="text-sm text-stone-400 mt-2">
                  A IA pode sugerir pautas e horários, mas nada entra no calendário até você revisar e salvar cada item.
                </p>
              </div>
              <button onClick={() => setIsPlanning(false)} className="p-2 text-stone-500 hover:text-white" aria-label="Fechar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Quantidade</label>
                <input type="number" min={1} max={14} value={planCount} onChange={(event) => setPlanCount(event.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Plataformas</label>
                <input value={planPlatforms} onChange={(event) => setPlanPlatforms(event.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white" placeholder="Ex.: Instagram, LinkedIn" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Formatos</label>
                <input value={planFormats} onChange={(event) => setPlanFormats(event.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white" placeholder="Ex.: Reel, Carrossel" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Objetivos</label>
                <input value={planObjectives} onChange={(event) => setPlanObjectives(event.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white" placeholder="Ex.: Venda, Autoridade" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Instruções opcionais</label>
                <textarea value={planInstructions} onChange={(event) => setPlanInstructions(event.target.value)} rows={2} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white resize-none" placeholder="Restrições, campanha ou foco da semana" />
              </div>
            </div>

            {planError && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {planError}
              </div>
            )}
            {planWarning && (
              <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {planWarning}
              </div>
            )}

            {planSuggestions.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="text-xs font-black uppercase tracking-wider text-stone-500">Sugestões aguardando revisão</div>
                {planSuggestions.map((suggestion, index) => (
                  <div key={`${suggestion.date}-${suggestion.platform}-${suggestion.title}`} className="p-4 rounded-xl border border-white/10 bg-black/20 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white">{suggestion.title}</div>
                      <div className="text-xs text-stone-400 mt-1">
                        {suggestion.date}{suggestion.time ? ` · ${suggestion.time}` : ""} · {suggestion.platform} · {suggestion.format}
                      </div>
                      <div className="text-xs text-stone-500 mt-1">Objetivo sugerido: {suggestion.objective}</div>
                    </div>
                    <button onClick={() => reviewSuggestion(suggestion, index)} className="shrink-0 px-3 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold">
                      Revisar
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button disabled={isGeneratingPlan} onClick={handlePlanWeek} className="bg-pink-600 hover:bg-pink-500 text-white rounded-xl px-5 py-3 font-bold text-sm transition-colors flex items-center justify-center disabled:opacity-50">
                {isGeneratingPlan ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-2" /> Gerar sugestões</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {editorDraft && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111322] border border-white/10 rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Revisar conteúdo</h2>
                <p className="text-xs text-stone-500 mt-1">Só será persistido depois que os campos obrigatórios forem confirmados.</p>
              </div>
              <button onClick={() => setEditorDraft(null)} className="p-2 text-stone-500 hover:text-white" aria-label="Fechar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Título</label>
                <input value={editorDraft.title} onChange={(event) => setEditorDraft({ ...editorDraft, title: event.target.value })} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white" placeholder="Título do conteúdo" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Data</label>
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
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Prioridade</label>
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
              <button disabled={isSavingItem} onClick={handleDeleteItem} className="text-sm font-bold text-red-500 hover:text-red-400 transition-colors flex items-center gap-2 disabled:opacity-50">
                <Trash2 className="w-4 h-4" /> Excluir
              </button>
              <div className="flex gap-3">
                <button onClick={() => setEditorDraft(null)} className="bg-white/5 hover:bg-white/10 text-white rounded-xl px-4 py-2 font-bold text-sm transition-colors">Cancelar</button>
                <button disabled={isSavingItem} onClick={handleSaveItem} className="bg-pink-600 hover:bg-pink-500 text-white rounded-xl px-4 py-2 font-bold text-sm transition-colors flex items-center gap-2 disabled:opacity-50">
                  {isSavingItem ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
