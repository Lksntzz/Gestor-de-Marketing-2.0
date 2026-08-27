import React, { useMemo } from "react";
import {
  Bot,
  CheckCircle2,
  Clock3,
  Database,
  Play,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Workflow,
  Zap,
} from "lucide-react";
import { AutomationRule, MarketingTask, ObsidianApiConfig } from "../types";
import { ExecutionCommandCenter } from "./ExecutionCommandCenter";

interface TasksAutomationViewProps {
  tasks: MarketingTask[];
  automationRules: AutomationRule[];
  onToggleTaskStatus: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenNewTaskModal: () => void;
  onToggleRule: (ruleId: string) => void;
  onRunRuleNow: (ruleId: string) => void;
  onSyncDailyNote: () => void;
  apiConfig: ObsidianApiConfig;
  isSyncingDaily: boolean;
  initialSection?: "tasks" | "automations";
}

const triggerLabel: Record<AutomationRule["trigger"], string> = {
  on_campaign_created: "Por evento",
  daily_schedule: "Diário",
  on_note_tagged: "Ao classificar nota",
  reminder_triggered: "Por lembrete",
};

const actionCategory: Record<AutomationRule["action"], string> = {
  create_tasks_in_daily_note: "Sync Vault",
  schedule_reminders: "Lembretes",
  push_to_obsidian_api: "Obsidian",
  generate_status_report: "Relatórios",
};

export const TasksAutomationView: React.FC<TasksAutomationViewProps> = (props) => {
  const { initialSection = "tasks" } = props;

  if (initialSection === "tasks") {
    return (
      <ExecutionCommandCenter
        tasks={props.tasks}
        onToggleTaskStatus={props.onToggleTaskStatus}
        onDeleteTask={props.onDeleteTask}
        onOpenNewTaskModal={props.onOpenNewTaskModal}
        onSyncDailyNote={props.onSyncDailyNote}
        apiConfig={props.apiConfig}
        isSyncingDaily={props.isSyncingDaily}
      />
    );
  }

  return <AutomationCommandCenter {...props} />;
};

const AutomationCommandCenter: React.FC<TasksAutomationViewProps> = ({
  automationRules,
  onToggleRule,
  onRunRuleNow,
  onSyncDailyNote,
  apiConfig,
  isSyncingDaily,
}) => {
  const activeRules = automationRules.filter((rule) => rule.enabled);
  const lastRun = useMemo(() => {
    const values = automationRules.map((rule) => rule.lastRun).filter(Boolean) as string[];
    return values.sort((a, b) => b.localeCompare(a))[0] || null;
  }, [automationRules]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f8fafc] text-slate-900 -mx-4 sm:-mx-6 lg:-mx-8 -my-6 md:-my-8 px-6 py-7 font-sans overflow-y-auto">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_475px] gap-6 items-start border-b border-slate-400 pb-5">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Centro de Automações</h1>
            <p className="text-sm text-slate-500 mt-1">Gerencie fluxos operacionais, sincronizações com Obsidian e rotinas de inteligência.</p>
          </div>
          <div className="bg-[#182234] border border-[#334155] text-white grid grid-cols-3 divide-x divide-[#334155] rounded-sm">
            <StatusMetric label="Estado Atual" value={activeRules.length ? `${activeRules.length} Ativa${activeRules.length === 1 ? "" : "s"}` : "Inativo"} dot={activeRules.length > 0} />
            <StatusMetric label="Última Execução" value={lastRun || "Sem registro"} />
            <StatusMetric label="Próxima Execução" value={activeRules.length ? "Por gatilho" : "—"} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5">
          {automationRules.length ? automationRules.map((rule, index) => (
            <div key={rule.id} className={`min-h-[365px] bg-[#182234] text-slate-100 border border-[#334155] border-l-4 rounded-sm p-5 flex flex-col ${index % 3 === 2 ? "border-l-violet-600" : "border-l-blue-500"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-11 h-11 bg-[#1e2a3e] flex items-center justify-center shrink-0 text-blue-400">
                    {index % 3 === 0 ? <RefreshCw className="w-5 h-5" /> : index % 3 === 1 ? <Workflow className="w-5 h-5" /> : <Bot className="w-5 h-5 text-violet-400" />}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold leading-5">{rule.name}</h2>
                    <p className="text-[10px] font-mono text-slate-500 mt-1">{rule.id}</p>
                  </div>
                </div>
                <button onClick={() => onToggleRule(rule.id)} className={rule.enabled ? "text-blue-400" : "text-slate-600"} title={rule.enabled ? "Desativar" : "Ativar"}>
                  {rule.enabled ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9" />}
                </button>
              </div>

              <p className="text-xs text-slate-400 leading-5 mt-5 min-h-[62px]">{rule.description}</p>

              <div className="grid grid-cols-3 gap-2 mt-5">
                <InfoCell label="Status" value={rule.enabled ? "● Ativo" : "○ Inativo"} valueClass={rule.enabled ? "text-emerald-400" : "text-slate-500"} />
                <InfoCell label="Frequência" value={triggerLabel[rule.trigger]} />
                <InfoCell label="Categoria" value={actionCategory[rule.action]} />
              </div>

              <div className="mt-auto pt-5 border-t border-[#334155] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                  <Database className="w-3.5 h-3.5 text-cyan-400" /> {rule.executionCount} execuções
                </div>
                <button onClick={() => onRunRuleNow(rule.id)} disabled={!rule.enabled} className="h-9 px-4 border border-[#475569] hover:bg-[#263140] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-2">
                  <Play className="w-3.5 h-3.5" /> Executar Agora
                </button>
              </div>
            </div>
          )) : (
            <div className="lg:col-span-2 2xl:col-span-3 py-16 text-center bg-white border border-slate-300 text-sm text-slate-500">Nenhuma regra configurada.</div>
          )}
        </div>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2"><Clock3 className="w-5 h-5 text-slate-500" /> Histórico de Execuções</h2>
            <button onClick={onSyncDailyNote} disabled={isSyncingDaily} className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50">{isSyncingDaily ? "Sincronizando..." : "Sincronizar Daily Note"}</button>
          </div>
          <div className="bg-[#182234] border border-[#334155] rounded-sm overflow-hidden text-slate-100">
            <div className="grid grid-cols-[1.2fr_0.65fr_1.5fr_0.9fr_0.45fr] gap-3 px-4 py-3 bg-[#151b24] text-[10px] uppercase tracking-[0.08em] font-bold text-slate-400 border-b border-[#334155]">
              <span>Automação</span><span>Status</span><span>Resultado (Resumo)</span><span>Timestamp</span><span>Duração</span>
            </div>
            {automationRules.map((rule) => (
              <div key={`history-${rule.id}`} className="grid grid-cols-[1.2fr_0.65fr_1.5fr_0.9fr_0.45fr] gap-3 px-4 py-3 text-xs border-b border-[#334155] last:border-b-0 items-center">
                <span className="font-mono text-slate-200 truncate">{rule.name}</span>
                <span className={rule.lastRun ? "text-emerald-400" : "text-slate-500"}>{rule.lastRun ? "Registrado" : "Sem execução"}</span>
                <span className="text-slate-400 truncate">{rule.lastRun ? `${rule.executionCount} execução(ões) registradas para esta regra.` : "Nenhum resultado armazenado ainda."}</span>
                <span className="text-slate-400 font-mono truncate">{rule.lastRun || "—"}</span>
                <span className="text-slate-500">—</span>
              </div>
            ))}
            {!automationRules.length && <div className="py-10 text-center text-xs text-slate-500">Sem histórico disponível.</div>}
          </div>
        </section>

        <footer className="text-[10px] font-mono text-slate-500 flex flex-wrap gap-5">
          <span>Obsidian: {apiConfig.connectionStatus === "connected" ? "Sincronizado" : "Desconectado"}</span>
          <span>{activeRules.length}/{automationRules.length} regras ativas</span>
          <span>Os resultados exibem apenas dados realmente registrados pelas regras.</span>
        </footer>
      </div>
    </div>
  );
};

const StatusMetric: React.FC<{ label: string; value: string; dot?: boolean }> = ({ label, value, dot }) => (
  <div className="p-4 min-w-0">
    <p className="text-[10px] uppercase tracking-[0.08em] font-bold text-slate-400">{label}</p>
    <p className="text-xs font-mono mt-1 truncate">{dot && <span className="text-emerald-400">● </span>}{value}</p>
  </div>
);

const InfoCell: React.FC<{ label: string; value: string; valueClass?: string }> = ({ label, value, valueClass = "text-slate-100" }) => (
  <div className="bg-[#111827] p-3 min-h-[62px]">
    <p className="text-[9px] uppercase text-slate-500">{label}</p>
    <p className={`text-[11px] mt-2 ${valueClass}`}>{value}</p>
  </div>
);
