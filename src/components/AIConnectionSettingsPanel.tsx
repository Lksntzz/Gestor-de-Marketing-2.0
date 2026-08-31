import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, Brain, CheckCircle2, Key, Loader2, RefreshCw, Unplug } from "lucide-react";
import type {
  AIConnectionProvider,
  AIConnectionStatus,
  PersistedAIConnectionState,
} from "../domain/aiConnection";

interface DiscoveredModelView {
  id: string;
  displayName?: string;
  ownedBy?: string;
  supportedActions?: string[];
}

interface AIConnectionProposalView {
  provider: AIConnectionProvider;
  state: PersistedAIConnectionState;
  models: DiscoveredModelView[];
}

interface AIConnectionSnapshotView {
  state: PersistedAIConnectionState;
  proposal?: AIConnectionProposalView;
}

interface AIConnectionOperationResultView extends AIConnectionSnapshotView {
  success: boolean;
  provider?: AIConnectionProvider;
  model?: string;
  message?: string;
  code?: string;
}

interface AIConnectionBridge {
  setAIConnectionCredential: (credential: string) => Promise<{ success: boolean; changed?: boolean }>;
  clearAIConnectionCredential: () => Promise<{ success: boolean }>;
  getAIConnectionState: () => Promise<AIConnectionSnapshotView>;
  confirmAIProvider: (provider: AIConnectionProvider) => Promise<AIConnectionOperationResultView>;
  validateAIModel: (provider: AIConnectionProvider, model: string) => Promise<AIConnectionOperationResultView>;
}

const STATUS_LABELS: Record<AIConnectionStatus, string> = {
  SEM_CHAVE: "Sem chave configurada",
  ANALISANDO_LOCALMENTE: "Analisando credencial localmente",
  PROVEDOR_POSSIVEL: "Provedor sugerido; confirmação necessária",
  AGUARDANDO_CONFIRMACAO_DE_PROVEDOR: "Aguardando confirmação do provedor",
  VALIDANDO_CREDENCIAL: "Validando credencial",
  CHAVE_INVALIDA: "Chave inválida",
  SEM_PERMISSAO: "Credencial sem permissão suficiente",
  LIMITE_OU_COTA: "Limite ou cota do provedor atingido",
  PROVEDOR_INDISPONIVEL: "Provedor temporariamente indisponível",
  CHAVE_CONFIRMADA: "Chave confirmada",
  DESCOBRINDO_MODELOS: "Descobrindo modelos disponíveis",
  AGUARDANDO_MODELO: "Selecione um modelo",
  VALIDANDO_MODELO: "Validando modelo",
  CONEXAO_ATIVA: "Conexão ativa",
};

function providerLabel(provider: AIConnectionProvider): string {
  return provider === "openai" ? "OpenAI" : "Google Gemini";
}

function getBridge(): AIConnectionBridge | null {
  if (!window.electronAPI) return null;
  const bridge = window.electronAPI as typeof window.electronAPI & Partial<AIConnectionBridge>;
  if (
    !bridge.setAIConnectionCredential ||
    !bridge.clearAIConnectionCredential ||
    !bridge.getAIConnectionState ||
    !bridge.confirmAIProvider ||
    !bridge.validateAIModel
  ) {
    return null;
  }
  return bridge as AIConnectionBridge;
}

function resolveProvider(snapshot: AIConnectionSnapshotView | null): AIConnectionProvider {
  return snapshot?.proposal?.provider
    ?? snapshot?.state.provider
    ?? snapshot?.state.providerCandidate
    ?? "gemini";
}

function resolveSelectedModel(snapshot: AIConnectionSnapshotView | null): string {
  if (!snapshot) return "";
  const proposalModels = snapshot.proposal?.models ?? [];
  const candidate = snapshot.proposal?.state.modelCandidate ?? snapshot.state.modelCandidate ?? snapshot.state.model;
  if (candidate && proposalModels.some((model) => model.id === candidate)) return candidate;
  return proposalModels[0]?.id ?? "";
}

export const AIConnectionSettingsPanel: React.FC = () => {
  const bridge = useMemo(() => getBridge(), []);
  const [snapshot, setSnapshot] = useState<AIConnectionSnapshotView | null>(null);
  const [provider, setProvider] = useState<AIConnectionProvider>("gemini");
  const [credential, setCredential] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const applySnapshot = (next: AIConnectionSnapshotView) => {
    setSnapshot(next);
    setProvider(resolveProvider(next));
    setSelectedModel(resolveSelectedModel(next));
  };

  const refresh = async () => {
    if (!bridge) return;
    const next = await bridge.getAIConnectionState();
    applySnapshot(next);
  };

  useEffect(() => {
    if (!bridge) return;
    let cancelled = false;
    bridge.getAIConnectionState()
      .then((next) => {
        if (!cancelled) applySnapshot(next);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setFeedback({ success: false, message: err?.message || "Não foi possível carregar o estado da conexão de IA." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  if (!bridge) {
    return (
      <div className="space-y-4 animate-fadeIn">
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-pink-500" />
            <span>Conexão de IA</span>
          </h3>
          <p className="text-xs text-text-secondary leading-normal">
            A conexão única de IA usa o armazenamento seguro do sistema operacional e está disponível no aplicativo desktop.
          </p>
        </div>
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
          Abra o Nisti Marketing para Windows para configurar, validar e ativar a conexão de IA.
        </div>
      </div>
    );
  }

  const activeState = snapshot?.state;
  const proposal = snapshot?.proposal;
  const models = proposal?.models ?? [];
  const activeConnection = activeState?.status === "CONEXAO_ATIVA";
  const isLegacyConnection = Boolean(activeState?.secretRef?.startsWith("legacy:"));

  const handleDiscover = async () => {
    setIsBusy(true);
    setFeedback(null);
    try {
      const nextCredential = credential.trim();
      if (nextCredential) {
        const stored = await bridge.setAIConnectionCredential(nextCredential);
        if (!stored?.success) {
          throw new Error("O sistema operacional não confirmou o armazenamento seguro da chave.");
        }
        setCredential("");
      }

      const result = await bridge.confirmAIProvider(provider);
      applySnapshot(result);
      if (!result.success) {
        setFeedback({ success: false, message: result.message || "Não foi possível validar o provedor selecionado." });
        return;
      }

      const discoveredCount = result.proposal?.models?.length ?? 0;
      setFeedback({
        success: true,
        message: discoveredCount > 0
          ? `${providerLabel(provider)} confirmado. ${discoveredCount} modelo(s) disponível(is) para seleção.`
          : `${providerLabel(provider)} confirmado, mas nenhum modelo compatível foi retornado.`,
      });
    } catch (err: any) {
      setFeedback({ success: false, message: err?.message || "Falha ao configurar a conexão de IA." });
      await refresh().catch(() => undefined);
    } finally {
      setIsBusy(false);
    }
  };

  const handleActivate = async () => {
    if (!selectedModel || !proposal) return;
    setIsBusy(true);
    setFeedback(null);
    try {
      const result = await bridge.validateAIModel(proposal.provider, selectedModel);
      applySnapshot(result);
      setFeedback({
        success: result.success,
        message: result.success
          ? `${providerLabel(proposal.provider)} conectado com o modelo ${result.model || selectedModel}.`
          : result.message || "O modelo selecionado não pôde ser ativado.",
      });
    } catch (err: any) {
      setFeedback({ success: false, message: err?.message || "Falha ao validar o modelo selecionado." });
      await refresh().catch(() => undefined);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setIsBusy(true);
    setFeedback(null);
    try {
      const result = await bridge.clearAIConnectionCredential();
      if (!result?.success) throw new Error("Não foi possível remover a credencial protegida.");
      setCredential("");
      await refresh();
      setFeedback({ success: true, message: "Credencial removida e conexão de IA encerrada." });
    } catch (err: any) {
      setFeedback({ success: false, message: err?.message || "Falha ao encerrar a conexão de IA." });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="space-y-1.5">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
          <Brain className="w-4 h-4 text-pink-500" />
          <span>Conexão única de IA</span>
        </h3>
        <p className="text-xs text-text-secondary leading-normal">
          Configure uma única credencial ativa. A chave é gravada no armazenamento seguro do Windows e nunca é carregada de volta na interface.
        </p>
      </div>

      <div className="p-4 bg-pink-500/5 border border-pink-500/30 rounded-xl space-y-4">
        <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-[#0f131c] border border-outline-border">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-text-secondary font-bold">Estado da conexão</div>
            <div className={`mt-1 text-xs font-bold ${activeConnection ? "text-emerald-400" : "text-text-primary"}`}>
              {activeState ? STATUS_LABELS[activeState.status] : "Carregando estado..."}
            </div>
            {activeConnection && activeState?.provider && activeState.model && (
              <div className="mt-1 text-[11px] text-text-secondary font-mono break-all">
                {providerLabel(activeState.provider)} · {activeState.model}
              </div>
            )}
            {isLegacyConnection && (
              <div className="mt-1 text-[10px] text-amber-300">
                Conexão legada detectada. Informe uma chave no campo abaixo para migrar para a credencial única.
              </div>
            )}
          </div>
          {activeConnection ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <Brain className="w-5 h-5 text-pink-400 shrink-0" />
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-text-primary uppercase tracking-wider">Provedor</label>
          <select
            value={provider}
            onChange={(event) => {
              setProvider(event.target.value as AIConnectionProvider);
              setSelectedModel("");
              setFeedback(null);
            }}
            disabled={isBusy}
            className="w-full px-3 py-2.5 bg-[#0f131c] border border-pink-500/30 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-pink-500 disabled:opacity-60"
          >
            <option value="gemini">Google Gemini</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-pink-500" />
            <span>Chave da conexão</span>
          </label>
          <input
            type="password"
            value={credential}
            onChange={(event) => {
              setCredential(event.target.value);
              setFeedback(null);
            }}
            disabled={isBusy}
            autoComplete="off"
            className="w-full px-3 py-2.5 bg-[#0f131c] border border-pink-500/30 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-pink-500 disabled:opacity-60"
            placeholder={activeConnection ? "Deixe vazio para manter a chave atual; digite para substituir" : "Cole a chave do provedor selecionado"}
          />
          <p className="text-[10px] text-text-secondary leading-normal">
            O campo é somente de entrada. Depois de salva, a chave não é exibida, retornada pelo preload ou persistida no localStorage.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDiscover}
          disabled={isBusy || (!credential.trim() && activeState?.status === "SEM_CHAVE")}
          className="w-full py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          <span>{credential.trim() ? "Salvar chave e buscar modelos" : "Validar provedor e atualizar modelos"}</span>
        </button>

        {proposal && models.length > 0 && (
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-text-primary uppercase tracking-wider">Modelo disponível</label>
              <select
                value={selectedModel}
                onChange={(event) => {
                  setSelectedModel(event.target.value);
                  setFeedback(null);
                }}
                disabled={isBusy}
                className="w-full px-3 py-2.5 bg-[#0f131c] border border-pink-500/30 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-pink-500 disabled:opacity-60"
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.displayName ? `${model.displayName} — ${model.id}` : model.id}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleActivate}
              disabled={isBusy || !selectedModel}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Validar e ativar modelo</span>
            </button>
          </div>
        )}

        {feedback && (
          <div className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
            feedback.success
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
          }`}>
            {feedback.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div className="text-[11px] leading-relaxed">{feedback.message}</div>
          </div>
        )}

        {(activeState?.secretRef || credential) && (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={isBusy}
            className="w-full py-2 text-xs font-semibold text-rose-300 border border-rose-500/30 rounded-lg hover:bg-rose-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Unplug className="w-3.5 h-3.5" />
            <span>Remover credencial e desconectar</span>
          </button>
        )}
      </div>

      <div className="text-[11px] text-text-secondary leading-relaxed bg-surface-container-low p-3 rounded-lg border border-outline-border">
        Esta tela já usa o runtime canônico da conexão única. Os fluxos de geração ainda serão migrados separadamente antes de uma nova release estável.
      </div>
    </div>
  );
};
