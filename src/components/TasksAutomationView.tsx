import React from "react";
import { CheckCircle2, Play, RefreshCw, ToggleLeft, ToggleRight, Zap } from "lucide-react";
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

  return <AutomationBridge {...props} />;
};

const AutomationBridge: React.FC<TasksAutomationViewProps> = ({
  automationRules,
  onToggleRule,
  onRunRuleNow,
  onSyncDailyNote,
  isSyncingDaily,
}) => (
  <div className="min-h-[calc(100vh-4rem)] bg-[#0f131c] text-slate-100 -mx-4 sm:-mx-6 lg:-mx-8 -my-6 md:-my-8 px-6 py-7 font-sans overflow-y-auto">
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automações</h1>
          <p className="text-sm text-slate-500 mt-1">Regras operacionais atuais. O visual definitivo será aplicado na etapa específica de Automações.</p>
        </div>
        <button onClick={onSyncDailyNote} disabled={isSyncingDaily} className="h-9 px-4 bg-[#182234] border border-[#334155] text-xs font-semibold disabled:opacity-50 flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${isSyncingDaily ? "animate-spin" : ""}`} /> {isSyncingDaily ? "Sincronizando..." : "Sincronizar Daily"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {automationRules.length ? automationRules.map((rule) => (
          <div key={rule.id} className="bg-[#182234] border border-[#334155] rounded-sm p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-slate-500"><Zap className="w-3.5 h-3.5" /> {rule.trigger.replaceAll("_", " ")}</div>
                <h2 className="text-base font-semibold mt-2">{rule.name}</h2>
                <p className="text-xs text-slate-400 leading-5 mt-2">{rule.description}</p>
              </div>
              <button onClick={() => onToggleRule(rule.id)} className={rule.enabled ? "text-emerald-400" : "text-slate-600"} title={rule.enabled ? "Desativar" : "Ativar"}>
                {rule.enabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
              </button>
            </div>
            <div className="mt-5 pt-4 border-t border-[#334155] flex items-center justify-between gap-3">
              <span className="text-[10px] text-slate-500 font-mono inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {rule.executionCount} execuções</span>
              <button onClick={() => onRunRuleNow(rule.id)} className="h-8 px-3 bg-[#2563eb] hover:bg-blue-500 text-xs font-semibold flex items-center gap-1.5"><Play className="w-3.5 h-3.5" /> Executar</button>
            </div>
          </div>
        )) : <div className="lg:col-span-2 py-16 text-center text-sm text-slate-500 border border-[#263140] bg-[#111827]">Nenhuma regra de automação configurada.</div>}
      </div>
    </div>
  </div>
);
