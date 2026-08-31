import React, { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Layers,
  Sparkles,
  Share2,
  Copy,
  Check,
} from "lucide-react";
import type { EditorialItem, MarketingCampaign, MarketingTask, ObsidianNote } from "../types";
import { buildCampaignEditorialSummary, exportCampaignToMarkdown } from "../domain/campaignExecution";
import { localDateKey } from "../utils/reliability";

interface CampaignExecutionHubProps {
  campaigns: MarketingCampaign[];
  editorialItems: EditorialItem[];
  tasks: MarketingTask[];
  notes?: ObsidianNote[];
  onSaveCampaignToVault?: (payload: { title: string; folder: string; content: string }) => Promise<void>;
  onNavigateToCalendar?: () => void;
  onNavigateToTasks?: () => void;
}

export const CampaignExecutionHub: React.FC<CampaignExecutionHubProps> = ({
  campaigns,
  editorialItems,
  tasks,
  notes = [],
  onSaveCampaignToVault,
  onNavigateToCalendar,
  onNavigateToTasks,
}) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(campaigns[0]?.id || "");
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId) || campaigns[0];

  if (!selectedCampaign) {
    return (
      <div className="p-8 text-center text-stone-400 bg-surface-card rounded-2xl border border-outline-border">
        <Layers className="w-12 h-12 mx-auto text-pink-500/40 mb-3" />
        <h3 className="text-lg font-bold text-text-primary">Nenhuma campanha cadastrada</h3>
        <p className="text-xs text-text-secondary mt-1">Crie ou sincronize uma campanha em Campanhas para acompanhar a execução aqui.</p>
      </div>
    );
  }

  const summary = buildCampaignEditorialSummary(selectedCampaign, editorialItems);
  const linkedTasks = tasks.filter(
    (t) => t.linkedCampaignId === selectedCampaign.id || t.tags.includes(selectedCampaign.id)
  );

  const handleCopyMarkdown = () => {
    const md = exportCampaignToMarkdown(selectedCampaign, editorialItems, tasks);
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToObsidian = async () => {
    if (!onSaveCampaignToVault || isSaving) return;
    setIsSaving(true);
    try {
      const md = exportCampaignToMarkdown(selectedCampaign, editorialItems, tasks);
      const campTitle = selectedCampaign.title || (selectedCampaign as any).name || "Sem título";
      await onSaveCampaignToVault({
        title: `Campanha - ${campTitle}`,
        folder: "04_Campanhas",
        content: md,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Campaign Selector Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl border border-outline-border bg-surface-card">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-text-secondary tracking-wider block">Campanha Selecionada</label>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="bg-surface-elevated text-sm font-bold text-text-primary border border-outline-border rounded-lg px-3 py-1.5 mt-0.5 focus:outline-none focus:border-pink-500/50"
            >
              {campaigns.map((camp) => (
                <option key={camp.id} value={camp.id}>
                  {camp.title || (camp as any).name || "Campanha"} ({camp.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="px-3.5 py-2 rounded-xl border border-outline-border bg-surface-elevated hover:bg-surface-container text-xs font-semibold text-text-primary flex items-center gap-2 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copiado!" : "Copiar Markdown"}
          </button>
          {onSaveCampaignToVault && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveToObsidian}
              className="px-3.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {saveSuccess ? <CheckCircle2 className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {saveSuccess ? "Salvo em 04_Campanhas" : isSaving ? "Salvando..." : "Salvar no Vault"}
            </button>
          )}
        </div>
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-outline-border bg-surface-card">
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Total de Peças</span>
          <span className="text-2xl font-black text-text-primary mt-1 block">{summary.totalPieces}</span>
        </div>
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Publicadas</span>
          <span className="text-2xl font-black text-emerald-300 mt-1 block">{summary.completedPieces}</span>
        </div>
        <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">Agendadas</span>
          <span className="text-2xl font-black text-blue-300 mt-1 block">{summary.scheduledPieces}</span>
        </div>
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Em Produção</span>
          <span className="text-2xl font-black text-amber-300 mt-1 block">{summary.draftPieces}</span>
        </div>
      </div>

      {/* Editorial Timeline by Phase */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
          <Calendar className="w-4 h-4 text-pink-500" /> Fases & Peças da Campanha
        </h3>

        <div className="space-y-3">
          {summary.phases.map((phase, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-outline-border bg-surface-card space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <h4 className="text-sm font-bold text-text-primary">{phase.name}</h4>
                  <p className="text-xs text-text-secondary">{phase.description}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-outline-border bg-surface-elevated text-text-secondary self-start sm:self-auto">
                  {phase.items.length} peça(s)
                </span>
              </div>

              {phase.items.length === 0 ? (
                <div className="text-xs text-text-secondary/60 italic p-3 rounded-lg bg-surface-elevated/40 border border-outline-border/50 text-center">
                  Nenhuma peça cadastrada para esta fase. Planeje novos conteúdos no Hub de Criação ou Calendário.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                  {phase.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-outline-border bg-surface-elevated flex flex-col justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface-card border border-outline-border text-text-secondary">
                            {item.platform}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              item.status === "PUBLISHED"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : item.status === "SCHEDULED"
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-amber-500/20 text-amber-400"
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                        <h5 className="text-xs font-bold text-text-primary line-clamp-2">{item.title}</h5>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-text-secondary pt-2 border-t border-outline-border/40">
                        <span>{item.contentType}</span>
                        <span>{item.scheduledDate || "Sem data"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Linked Tasks */}
      <div className="p-4 rounded-xl border border-outline-border bg-surface-card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Tarefas Operacionais ({linkedTasks.length})
          </h3>
          {onNavigateToTasks && (
            <button
              type="button"
              onClick={onNavigateToTasks}
              className="text-xs text-pink-400 hover:text-pink-300 font-semibold"
            >
              Ver no Quadro de Execução ➔
            </button>
          )}
        </div>

        {linkedTasks.length === 0 ? (
          <div className="text-xs text-text-secondary/60 italic p-4 rounded-lg bg-surface-elevated/40 text-center">
            Nenhuma tarefa operacional vinculada a esta campanha.
          </div>
        ) : (
          <div className="space-y-2">
            {linkedTasks.map((task) => (
              <div
                key={task.id}
                className="p-2.5 rounded-lg border border-outline-border bg-surface-elevated flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      task.status === "done"
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-outline-border text-transparent"
                    }`}
                  >
                    <Check className="w-3 h-3" />
                  </span>
                  <span className={`font-medium truncate ${task.status === "done" ? "line-through text-text-secondary" : "text-text-primary"}`}>
                    {task.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-surface-card border border-outline-border text-text-secondary">
                    {task.priority === "unspecified" ? "NÃO DEFINIDA" : task.priority.toUpperCase()}
                  </span>
                  {task.dueDate && <span className="text-text-secondary">{task.dueDate}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
