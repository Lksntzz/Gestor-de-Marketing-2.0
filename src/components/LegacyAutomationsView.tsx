import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";
import type {
  AutomationRule,
  MarketingTask,
  ObsidianApiConfig,
  ObsidianNote,
} from "../types";
import { api } from "../services/api";
import { APP_STATE_KEYS, StorageManager } from "../services/storage/StorageManager";
import {
  AUTOMATION_BLUEPRINTS,
  automationActionLabel,
  automationTriggerLabel,
  createAutomationRuleFromBlueprint,
  executeAutomationRule,
  formatAutomationLastRun,
  validateAutomationRule,
  type AutomationBlueprintId,
} from "../utils/automationIntelligence";

type Feedback = { type: "success" | "warning" | "info"; message: string } | null;

interface LegacyAutomationsViewProps {
  tasks: MarketingTask[];
  automationRules: AutomationRule[];
  apiConfig: ObsidianApiConfig;
}

const storage = StorageManager.getInstance();

export const LegacyAutomationsView: React.FC<LegacyAutomationsViewProps> = ({
  tasks = [],
  automationRules = [],
  apiConfig,
}) => {
  const [rules, setRules] = useState<AutomationRule[]>(() =>
    storage.loadAppState<AutomationRule[]>(APP_STATE_KEYS.AUTOMATION_RULES, automationRules)
  );
  const [vaultNotes, setVaultNotes] = useState<ObsidianNote[]>([]);
  const [runtimeConnected, setRuntimeConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [runningRuleId, setRunningRuleId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const persistRules = (next: AutomationRule[]) => {
    setRules(next);
    storage.saveAppState(APP_STATE_KEYS.AUTOMATION_RULES, next);
  };

  const refreshContext = async (): Promise<{ connected: boolean; notes: ObsidianNote[] }> => {
    setIsRefreshing(true);
    try {
      const connected =
        apiConfig.connectionStatus === "connected" && api.isObsidianSessionVerified();
      setRuntimeConnected(connected);

      if (!connected) {
        setVaultNotes([]);
        return { connected: false, notes: [] };
      }

      const notes = (await storage.readDesktopNotesForApp()) || [];
      setVaultNotes(notes);
      return { connected: true, notes };
    } catch {
      setRuntimeConnected(false);
      setVaultNotes([]);
      return { connected: false, notes: [] };
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void refreshContext();
  }, [apiConfig.connectionStatus]);

  const automationContext = useMemo(
    () => ({ isConnected: runtimeConnected, tasks, notes: vaultNotes }),
    [runtimeConnected, tasks, vaultNotes]
  );

  const enabledRules = useMemo(() => rules.filter((rule) => rule.enabled).length, [rules]);
  const readyRules = useMemo(
    () =>
      rules.filter((rule) =>
        validateAutomationRule({ ...rule, enabled: true }, automationContext).runnable
      ).length,
    [rules, automationContext]
  );
  const totalExecutions = useMemo(
    () => rules.reduce((sum, rule) => sum + Number(rule.executionCount || 0), 0),
    [rules]
  );

  const addAutomation = (blueprintId: AutomationBlueprintId) => {
    if (rules.some((rule) => rule.id === blueprintId)) {
      setFeedback({ type: "info", message: "Essa regra já está registrada." });
      return;
    }

    const rule = createAutomationRuleFromBlueprint(blueprintId);
    persistRules([...rules, rule]);
    setFeedback({
      type: "success",
      message: `Regra “${rule.name}” adicionada como inativa.`,
    });
  };

  const updateAutomationCondition = (ruleId: string, conditionParam: string) => {
    const next = rules.map((rule) =>
      rule.id === ruleId ? { ...rule, conditionParam, enabled: false } : rule
    );
    persistRules(next);
    setFeedback({
      type: "info",
      message: "Configuração alterada. A regra foi desativada e precisa ser habilitada novamente.",
    });
  };

  const toggleAutomation = async (ruleId: string) => {
    const target = rules.find((rule) => rule.id === ruleId);
    if (!target) return;

    if (target.enabled) {
      persistRules(rules.map((rule) => (rule.id === ruleId ? { ...rule, enabled: false } : rule)));
      setFeedback({ type: "info", message: `Regra “${target.name}” desativada.` });
      return;
    }

    const fresh = await refreshContext();
    const validation = validateAutomationRule(
      { ...target, enabled: true },
      { isConnected: fresh.connected, tasks, notes: fresh.notes }
    );

    if (!validation.runnable) {
      setFeedback({
        type: "warning",
        message: validation.reasons[0] || "A regra ainda não está pronta para ser habilitada.",
      });
      return;
    }

    persistRules(rules.map((rule) => (rule.id === ruleId ? { ...rule, enabled: true } : rule)));
    setFeedback({
      type: "success",
      message: `Regra “${target.name}” habilitada. A execução continua manual nesta versão.`,
    });
  };

  const deleteAutomation = (ruleId: string) => {
    const target = rules.find((rule) => rule.id === ruleId);
    persistRules(rules.filter((rule) => rule.id !== ruleId));
    setFeedback({
      type: "info",
      message: target ? `Regra “${target.name}” removida.` : "Regra removida.",
    });
  };

  const runAutomation = async (ruleId: string) => {
    const rule = rules.find((item) => item.id === ruleId);
    if (!rule || runningRuleId) return;

    setRunningRuleId(ruleId);
    setFeedback(null);

    try {
      const fresh = await refreshContext();
      const result = await executeAutomationRule(
        rule,
        { isConnected: fresh.connected, tasks, notes: fresh.notes },
        {
          syncPendingTasks: async (markdown) => {
            const response = await api
              .upsertDailyNoteSection(
                apiConfig,
                "automation-v2-pending-tasks",
                "📋 Tarefas pendentes — Automação Nisti",
                markdown
              )
              .catch((error: any) => ({
                success: false,
                message: error?.message || "Falha ao gravar a Daily Note.",
              }));

            return {
              success: Boolean(response?.success),
              message: response?.message,
            };
          },
          pushNote: async (note) => {
            const response = await api
              .pushNoteToObsidian(
                apiConfig,
                note.path,
                note.content,
                note.frontmatter as Record<string, unknown>
              )
              .catch((error: any) => ({
                success: false,
                message: error?.message || "Falha ao gravar a nota.",
              }));

            return {
              success: Boolean(response?.success),
              message: response?.message,
            };
          },
          logAudit: async (details) => {
            await storage.logAudit({
              action: "AUTOMATION_TRIGGERED",
              entityType: "AUTOMATION",
              entityId: rule.id,
              details: `[legacy fail-closed] ${rule.name}: ${details}`,
            });
          },
        }
      );

      if (!result.success) {
        setFeedback({ type: "warning", message: result.message });
        return;
      }

      const executedAt = new Date().toISOString();
      persistRules(
        rules.map((item) =>
          item.id === rule.id
            ? {
                ...item,
                executionCount: Number(item.executionCount || 0) + 1,
                lastRun: executedAt,
              }
            : item
        )
      );
      setFeedback({ type: "success", message: result.message });
      await refreshContext();
    } catch (error: any) {
      setFeedback({
        type: "warning",
        message: error?.message || "A automação falhou antes de receber confirmação do Obsidian.",
      });
    } finally {
      setRunningRuleId(null);
    }
  };

  return (
    <div className="w-full h-full min-h-0 overflow-y-auto no-scrollbar font-sans">
      <div className="max-w-6xl mx-auto w-full flex flex-col gap-4 pb-6">
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 border-b border-outline-border pb-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Compatibilidade legada</div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-text-primary">Automações</h1>
            <p className="mt-1 text-xs text-text-secondary max-w-3xl">
              Regras manuais preservadas durante a migração. Elas não fazem parte do fluxo principal do produto e não executam em segundo plano.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void refreshContext()}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-xl border border-outline-border bg-surface-card text-xs font-semibold text-text-primary disabled:opacity-40 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Atualizar contexto
          </button>
        </header>

        <div className="rounded-xl border border-warning-sober/30 bg-warning-sober/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-warning-sober shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-text-primary">Execução manual</p>
            <p className="mt-1 text-[11px] leading-5 text-text-secondary">
              Habilitar uma regra não cria um processo em segundo plano. A execução só ocorre quando você clica em Executar e todas as validações passam.
            </p>
          </div>
        </div>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ["Registradas", rules.length, Zap],
            ["Habilitadas", enabledRules, CheckCircle2],
            ["Prontas agora", readyRules, ShieldCheck],
            ["Execuções", totalExecutions, Play],
          ].map(([label, value, Icon]) => {
            const MetricIcon = Icon as React.ComponentType<{ className?: string }>;
            return (
              <div key={String(label)} className="rounded-xl border border-outline-border bg-surface-card p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-text-secondary">{String(label)}</span>
                  <MetricIcon className="w-4 h-4 text-primary-fixed-dim" />
                </div>
                <div className="mt-2 text-2xl font-black text-text-primary">{Number(value)}</div>
              </div>
            );
          })}
        </section>

        {feedback && (
          <div
            className={`rounded-xl border p-3 text-xs ${
              feedback.type === "success"
                ? "border-success-sober/30 bg-success-sober/10 text-success-sober"
                : feedback.type === "warning"
                  ? "border-error-sober/30 bg-error-sober/10 text-error-sober"
                  : "border-outline-border bg-surface-card text-text-secondary"
            }`}
          >
            {feedback.message}
          </div>
        )}

        <section className="rounded-2xl border border-outline-border bg-surface-card p-4">
          <div className="mb-3">
            <h2 className="text-sm font-bold text-text-primary">Adicionar regra segura</h2>
            <p className="mt-1 text-[11px] text-text-secondary">Templates entram desativados e sem histórico fictício.</p>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {AUTOMATION_BLUEPRINTS.map((blueprint) => {
              const alreadyAdded = rules.some((rule) => rule.id === blueprint.id);
              return (
                <article key={blueprint.id} className="rounded-xl border border-outline-border bg-surface-elevated/30 p-4 flex flex-col">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary-fixed-dim shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-xs font-bold text-text-primary">{blueprint.name}</h3>
                      <p className="mt-1 text-[11px] leading-5 text-text-secondary">{blueprint.description}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => addAutomation(blueprint.id)}
                    disabled={alreadyAdded}
                    className="mt-4 px-3 py-2 rounded-lg border border-outline-border text-xs font-semibold text-text-primary disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {alreadyAdded ? "Já adicionada" : "Adicionar regra"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-outline-border bg-surface-card p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-bold text-text-primary">Regras registradas</h2>
              <p className="mt-1 text-[11px] text-text-secondary">
                Runtime Obsidian: {runtimeConnected ? "validado" : "bloqueado"}.
              </p>
            </div>
          </div>

          {rules.length === 0 ? (
            <div className="min-h-40 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-outline-border">
              <Zap className="w-8 h-8 text-text-secondary" />
              <h3 className="mt-3 text-sm font-bold text-text-primary">Nenhuma regra registrada</h3>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {rules.map((rule) => {
                const validation = validateAutomationRule(rule, automationContext);
                const validationWhenEnabled = validateAutomationRule(
                  { ...rule, enabled: true },
                  automationContext
                );
                const running = runningRuleId === rule.id;

                return (
                  <article key={rule.id} className="rounded-xl border border-outline-border bg-surface-elevated/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-text-primary">{rule.name}</h3>
                          <span
                            className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${
                              !validation.supported
                                ? "border-error-sober/30 bg-error-sober/10 text-error-sober"
                                : rule.enabled
                                  ? "border-success-sober/30 bg-success-sober/10 text-success-sober"
                                  : "border-outline-border text-text-secondary"
                            }`}
                          >
                            {!validation.supported ? "Bloqueada" : rule.enabled ? "Ativa" : "Inativa"}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-5 text-text-secondary">{rule.description || "Sem descrição registrada."}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => deleteAutomation(rule.id)}
                        className="p-1.5 rounded-lg border border-outline-border text-text-secondary hover:text-error-sober"
                        title="Excluir regra"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-lg border border-outline-border p-2.5">
                        <span className="block text-text-secondary">Gatilho declarado</span>
                        <strong className="text-text-primary">{automationTriggerLabel(rule.trigger)}</strong>
                      </div>
                      <div className="rounded-lg border border-outline-border p-2.5">
                        <span className="block text-text-secondary">Ação</span>
                        <strong className="text-text-primary">{automationActionLabel(rule.action)}</strong>
                      </div>
                    </div>

                    {rule.action === "push_to_obsidian_api" && validation.supported && (
                      <div className="mt-3">
                        <label className="text-[10px] uppercase tracking-wider font-bold text-text-secondary">Nota autorizada para envio</label>
                        <select
                          value={rule.conditionParam || ""}
                          onChange={(event) => updateAutomationCondition(rule.id, event.target.value)}
                          className="mt-1.5 w-full px-3 py-2 rounded-lg border border-outline-border bg-surface-card text-xs text-text-primary outline-none"
                        >
                          <option value="">Selecione uma nota do snapshot validado</option>
                          {vaultNotes.map((note) => (
                            <option key={note.path} value={note.path}>{note.path}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {validationWhenEnabled.reasons.length > 0 && (
                      <div className="mt-3 rounded-lg border border-outline-border bg-surface-card p-2.5">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-text-secondary">Bloqueios atuais</p>
                        <ul className="mt-1.5 space-y-1 text-[11px] text-text-secondary">
                          {validationWhenEnabled.reasons.map((reason) => <li key={reason}>• {reason}</li>)}
                        </ul>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void toggleAutomation(rule.id)}
                        disabled={!validation.supported}
                        className={`px-3 py-2 rounded-lg border text-xs font-semibold disabled:opacity-40 ${
                          rule.enabled
                            ? "border-error-sober/30 text-error-sober"
                            : "border-outline-border text-text-primary"
                        }`}
                      >
                        {rule.enabled ? "Desativar" : "Habilitar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void runAutomation(rule.id)}
                        disabled={!validation.runnable || running || runningRuleId !== null}
                        className="px-3 py-2 rounded-lg bg-primary-container text-white text-xs font-bold disabled:opacity-40 flex items-center gap-1.5"
                      >
                        {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        {running ? "Executando..." : "Executar"}
                      </button>
                    </div>

                    <div className="mt-3 pt-3 border-t border-outline-border flex flex-wrap items-center justify-between gap-2 text-[10px] text-text-secondary">
                      <span>{Number(rule.executionCount || 0)} execução(ões) confirmada(s)</span>
                      <span>{formatAutomationLastRun(rule.lastRun)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
