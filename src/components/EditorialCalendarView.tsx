import React, { useState, useEffect } from "react";
import { Plus, ChevronLeft, ChevronRight, Sparkles, Loader2, Calendar, FileText } from "lucide-react";
import type { EditorialItem, MarketingTask, MarketingCampaign, IdeaItem, CreativeScript, ObsidianApiConfig } from "../types";

import { api } from "../services/api";

interface EditorialCalendarViewProps {
  tasks: MarketingTask[];
  onTasksChange: (tasks: MarketingTask[]) => void;
  campaigns: MarketingCampaign[];
  ideas: IdeaItem[];
  scripts: CreativeScript[];
  obsidianApiConfig: ObsidianApiConfig;
}

export const EditorialCalendarView: React.FC<EditorialCalendarViewProps> = ({
  tasks,
  onTasksChange,
  campaigns,
  ideas,
  scripts,
  obsidianApiConfig,
}) => {
  const [items, setItems] = useState<EditorialItem[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  });

  const [isPlanning, setIsPlanning] = useState(false);
  const [editingItem, setEditingItem] = useState<EditorialItem | null>(null);

  const handleSaveItem = async (updated: EditorialItem) => {
    updated.updatedAt = Date.now();
    await window.electronAPI?.editorialUpsert(updated);
    
    // Sync task
    if (updated.scheduledDate) {
      const existingTask = tasks.find(t => t.id === `task-ed-${updated.id}`);
      if (existingTask) {
        if (existingTask.dueDate !== updated.scheduledDate || existingTask.title !== `Publicar: ${updated.title}`) {
          const newTasks = tasks.map(t => t.id === existingTask.id ? { ...t, dueDate: updated.scheduledDate, title: `Publicar: ${updated.title}` } : t);
          onTasksChange(newTasks);
        }
      } else {
        const newTask: MarketingTask = {
          id: `task-ed-${updated.id}`,
          title: `Publicar: ${updated.title}`,
          status: "todo",
          priority: updated.priority || "medium",
          dueDate: updated.scheduledDate,
          dueTime: updated.scheduledTime,
          obsidianTaskString: `- [ ] Publicar: ${updated.title} 📅 ${updated.scheduledDate}`,
          tags: [],
          isReminderActive: false
        };
        onTasksChange([...tasks, newTask]);
      }
    }
    
    setEditingItem(null);
    loadItems();
  };
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planCount, setPlanCount] = useState("3");
  const [planPlatforms, setPlanPlatforms] = useState("Instagram, LinkedIn");
  const [planFormats, setPlanFormats] = useState("Reel, Carrossel, Artigo");
  const [planObjectives, setPlanObjectives] = useState("Autoridade, Venda");
  const [planInstructions, setPlanInstructions] = useState("");

  const handlePlanWeek = async () => {
    setIsGeneratingPlan(true);
    try {
      const ymdStart = formatDateYMD(currentWeekStart);
      
      const existingItems = items.filter(it => it.scheduledDate >= ymdStart).map(it => ({
        title: it.title,
        date: it.scheduledDate,
        platform: it.platform
      }));

      const payload = {
        weekStart: ymdStart,
        count: parseInt(planCount, 10) || 3,
        platforms: planPlatforms.split(',').map(s => s.trim()),
        formats: planFormats.split(',').map(s => s.trim()),
        objectives: planObjectives.split(',').map(s => s.trim()),
        customInstructions: planInstructions,
        existingItems
      };

      const res = await api.planWeek(payload);
      if (res.success && res.data && Array.isArray(res.data)) {
        for (const item of res.data) {
          const newItem: EditorialItem = {
            id: "ed-" + Date.now() + Math.random().toString(36).substr(2, 5),
            title: item.title,
            contentType: item.format,
            platform: item.platform,
            objective: item.objective,
            scheduledDate: item.date,
            scheduledTime: item.time,
            status: "DRAFT",
            priority: "medium",
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          await window.electronAPI?.editorialUpsert(newItem);
        }
        await loadItems();
        setIsPlanning(false);
        if (res.wasFallback) {
          alert("Modo offline: O planejamento foi gerado localmente sem IA. Revise os itens gerados.");
        }
      } else {
        alert("Erro ao gerar planejamento: formato de resposta inesperado.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Erro ao planejar semana: " + err.message);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const loadItems = async () => {
    if (window.electronAPI) {
      const dbItems = await window.electronAPI.editorialList();
      setItems(dbItems);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const changeWeek = (offset: number) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + offset * 7);
    setCurrentWeekStart(d);
  };

  const daysOfWeek = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const formatDateYMD = (d: Date) => {
    return d.toISOString().split("T")[0];
  };

  return (
    <div className="flex h-screen bg-[#0B0D1B] overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="px-8 py-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#0B0D1B] z-10">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Calendar className="w-6 h-6 text-pink-500" /> Calendário Editorial
            </h1>
            <p className="text-sm text-stone-400 mt-1">Planejamento e visão semanal de conteúdo</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsPlanning(true)}
              className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-600/30 transition-colors"
            >
              <Sparkles className="w-4 h-4" /> Planejar Semana
            </button>
            <button onClick={() => setEditingItem({
              id: "ed-" + Date.now(),
              title: "Novo Conteúdo",
              contentType: "Post",
              platform: "Instagram",
              objective: "Engajamento",
              scheduledDate: formatDateYMD(new Date()),
              status: "DRAFT",
              priority: "medium",
              createdAt: Date.now(),
              updatedAt: Date.now()
            })} className="bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
              <Plus className="w-4 h-4" /> Novo Conteúdo
            </button>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button onClick={() => changeWeek(-1)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-lg font-bold text-white capitalize">
                Semana de {currentWeekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
              </h2>
              <button onClick={() => changeWeek(1)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-4">
            {daysOfWeek.map((day, i) => {
              const ymd = formatDateYMD(day);
              const dayItems = items.filter(it => it.scheduledDate === ymd);
              const isToday = ymd === formatDateYMD(new Date());

              return (
                <div key={i} className={`flex flex-col bg-black/20 border ${isToday ? 'border-pink-500/50' : 'border-white/5'} rounded-2xl overflow-hidden min-h-[400px]`}>
                  <div className={`p-3 text-center border-b ${isToday ? 'border-pink-500/30 bg-pink-500/10' : 'border-white/5 bg-black/40'}`}>
                    <div className={`text-xs font-bold uppercase mb-1 ${isToday ? 'text-pink-400' : 'text-stone-500'}`}>
                      {day.toLocaleDateString("pt-BR", { weekday: "short" })}
                    </div>
                    <div className={`text-xl font-bold ${isToday ? 'text-white' : 'text-stone-300'}`}>
                      {day.getDate()}
                    </div>
                  </div>
                  <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                    {dayItems.length === 0 ? (
                      <div className="text-center text-[10px] text-stone-600 py-4 font-medium uppercase tracking-wider">Livre</div>
                    ) : (
                      dayItems.map(item => (
                        <div key={item.id} onClick={() => setEditingItem(item)} className="bg-white/5 border border-white/10 p-3 rounded-xl hover:bg-white/10 transition-colors cursor-pointer group">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-black/30 text-stone-400">
                              {item.scheduledTime || "S/H"}
                            </span>
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              item.status === 'PUBLISHED' ? 'bg-emerald-500/20 text-emerald-400' :
                              item.status === 'SCHEDULED' ? 'bg-blue-500/20 text-blue-400' :
                              item.status === 'DRAFT' ? 'bg-white/10 text-stone-400' :
                              'bg-amber-500/20 text-amber-400'
                            }`}>
                              {item.status}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-white mb-1 leading-snug line-clamp-2">{item.title}</h4>
                          <div className="flex flex-wrap gap-1 mt-2">
                            <span className="text-[9px] text-stone-400 bg-black/30 px-1.5 py-0.5 rounded border border-white/5">{item.platform}</span>
                            <span className="text-[9px] text-stone-400 bg-black/30 px-1.5 py-0.5 rounded border border-white/5">{item.contentType}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isPlanning && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111322] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-pink-500" /> Planejar Semana com IA
            </h2>
            <p className="text-sm text-stone-400 mb-6">
              A IA analisará seu cofre de conhecimento e os conteúdos já agendados para sugerir novas pautas na semana selecionada.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Quantidade</label>
                <input type="number" value={planCount} onChange={e => setPlanCount(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Plataformas</label>
                <input value={planPlatforms} onChange={e => setPlanPlatforms(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Formatos</label>
                <input value={planFormats} onChange={e => setPlanFormats(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Objetivos</label>
                <input value={planObjectives} onChange={e => setPlanObjectives(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Instruções Opcionais</label>
                <textarea value={planInstructions} onChange={e => setPlanInstructions(e.target.value)} rows={2} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white resize-none" placeholder="Ex: Focar em funil de vendas..." />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => setIsPlanning(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-3 font-bold text-sm transition-colors">
                Cancelar
              </button>
              <button disabled={isGeneratingPlan} onClick={handlePlanWeek} className="flex-1 bg-pink-600 hover:bg-pink-500 text-white rounded-xl py-3 font-bold text-sm transition-colors flex items-center justify-center disabled:opacity-50">
                {isGeneratingPlan ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Gerar Planejamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111322] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-6">Editar Conteúdo</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Título</label>
                <input value={editingItem.title} onChange={e => setEditingItem({...editingItem, title: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Data</label>
                  <input type="date" value={editingItem.scheduledDate} onChange={e => setEditingItem({...editingItem, scheduledDate: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Hora</label>
                  <input type="time" value={editingItem.scheduledTime || ''} onChange={e => setEditingItem({...editingItem, scheduledTime: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white [color-scheme:dark]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Plataforma</label>
                  <input value={editingItem.platform} onChange={e => setEditingItem({...editingItem, platform: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Formato</label>
                  <input value={editingItem.contentType} onChange={e => setEditingItem({...editingItem, contentType: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Status</label>
                <select value={editingItem.status} onChange={e => setEditingItem({...editingItem, status: e.target.value as any})} className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white">
                  <option value="DRAFT">Rascunho</option>
                  <option value="IN_PRODUCTION">Em Produção</option>
                  <option value="REVIEW">Revisão</option>
                  <option value="APPROVED">Aprovado</option>
                  <option value="SCHEDULED">Agendado</option>
                  <option value="PUBLISHED">Publicado</option>
                  <option value="ARCHIVED">Arquivado</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between items-center mt-8">
              <button onClick={async () => {
                await window.electronAPI?.editorialDelete(editingItem.id);
                setEditingItem(null);
                loadItems();
              }} className="text-sm font-bold text-red-500 hover:text-red-400 transition-colors">
                Excluir
              </button>
              <div className="flex gap-3">
                <button onClick={() => setEditingItem(null)} className="bg-white/5 hover:bg-white/10 text-white rounded-xl px-4 py-2 font-bold text-sm transition-colors">
                  Cancelar
                </button>
                <button onClick={() => handleSaveItem(editingItem)} className="bg-pink-600 hover:bg-pink-500 text-white rounded-xl px-4 py-2 font-bold text-sm transition-colors">
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
