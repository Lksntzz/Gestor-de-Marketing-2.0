import React, { useState, useEffect } from "react";
import {
  X,
  Settings,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Key,
  Globe,
  FolderOpen,
  Download,
  Upload,
  Trash2,
  Cloud,
  Brain,
  Loader2,
  LogOut,
  UserCheck,
} from "lucide-react";
import { ObsidianApiConfig } from "../types";
import { api } from "../services/api";
import { googleDriveService } from "../services/googleDriveService";

interface ObsidianApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ObsidianApiConfig;
  onSaveConfig: (newConfig: ObsidianApiConfig) => void;
  onTestConnection: (cfg: ObsidianApiConfig) => Promise<{ success: boolean; message: string }>;
  onExportVault: () => void;
  onImportVault: (file: File) => void;
  onClearAllData?: () => void;
}

type SettingsTab = "ai" | "obsidian" | "drive" | "system";

export const ObsidianApiSettingsModal: React.FC<ObsidianApiSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onTestConnection,
  onExportVault,
  onImportVault,
  onClearAllData,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("ai");
  const [formData, setFormData] = useState<ObsidianApiConfig>({ ...config });

  const [isTestingAi, setIsTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(googleDriveService.isAuthenticated());
  const [driveLoading, setDriveLoading] = useState<boolean>(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const runtimeConnected = api.isObsidianSessionVerified();
      setFormData({
        ...config,
        connectionStatus: runtimeConnected ? "connected" : "disconnected",
        errorMessage: runtimeConnected ? undefined : config.errorMessage,
      });
      setIsDriveConnected(googleDriveService.isAuthenticated());
      setAiTestResult(null);
      setTestResult(null);
      setConfirmClear(false);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleTestGemini = async () => {
    setIsTestingAi(true);
    setAiTestResult(null);
    try {
      const result = await api.testGeminiConnection(formData.geminiApiKey || "");
      setAiTestResult(result);
      if (result.success) {
        onSaveConfig({
          ...formData,
          connectionStatus: api.isObsidianSessionVerified() ? "connected" : "disconnected",
        });
      }
    } catch (err: any) {
      setAiTestResult({
        success: false,
        message: err.message || "Erro desconhecido ao testar o Gemini.",
      });
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleTestObsidian = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await onTestConnection(formData);
      setTestResult(res);
      if (res.success && api.isObsidianSessionVerified()) {
        const connectedConfig: ObsidianApiConfig = {
          ...formData,
          connectionStatus: "connected",
          errorMessage: undefined,
        };
        setFormData(connectedConfig);
        onSaveConfig(connectedConfig);
      } else {
        const message = res.success
          ? "A API respondeu, mas a sessão do Obsidian não foi validada completamente."
          : res.message;
        setFormData((current) => ({
          ...current,
          connectionStatus: "error",
          errorMessage: message,
        }));
        if (res.success) {
          setTestResult({ success: false, message });
        }
      }
    } catch (err: any) {
      const message = err.message || "Erro desconhecido ao testar conexão";
      setTestResult({ success: false, message });
      setFormData((current) => ({
        ...current,
        connectionStatus: "error",
        errorMessage: message,
      }));
    } finally {
      setIsTesting(false);
    }
  };

  const handleConnectDrive = async () => {
    setDriveLoading(true);
    setDriveError(null);
    try {
      await googleDriveService.getAccessToken();
      setIsDriveConnected(true);
    } catch (err: any) {
      setDriveError(err.message || "Erro ao conectar com o Google Drive.");
      setIsDriveConnected(false);
    } finally {
      setDriveLoading(false);
    }
  };

  const handleDisconnectDrive = () => {
    try {
      googleDriveService.disconnect();
    } catch (err) {
      console.error(err);
    }
    setIsDriveConnected(false);
  };

  const handleSave = () => {
    const hasCredentials = !!(formData.endpoint || "").trim() && !!(formData.apiKey || "").trim();
    if (hasCredentials) {
      api.markSessionAsConnectedManually();
    }
    const runtimeConnected = api.isObsidianSessionVerified() || hasCredentials;
    onSaveConfig({
      ...formData,
      connectionStatus: runtimeConnected ? "connected" : "disconnected",
      errorMessage: runtimeConnected ? undefined : formData.errorMessage,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f131c]/80 backdrop-blur-xs">
      <div className="bg-surface-card rounded-2xl border border-outline-border shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-outline-border flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#334155] text-white flex items-center justify-center font-bold">
              <Settings className="w-4 h-4 text-[#F8FAFC]" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wider text-text-primary">CONFIGURAÇÃO</h2>
              <p className="text-xs text-text-secondary">Gerencie IA, conexões locais de cofre e integrações em nuvem</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#94A3B8] hover:text-text-primary rounded-lg hover:bg-[#334155] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-outline-border bg-surface-container-low p-2 gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === "ai" ? "bg-pink-600 text-white shadow-xs" : "text-text-secondary hover:text-text-primary hover:bg-[#0f131c]"
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Inteligência Artificial (IA)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("obsidian")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === "obsidian" ? "bg-pink-600 text-white shadow-xs" : "text-text-secondary hover:text-text-primary hover:bg-[#0f131c]"
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Obsidian</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("drive")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === "drive" ? "bg-pink-600 text-white shadow-xs" : "text-text-secondary hover:text-text-primary hover:bg-[#0f131c]"
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Google Drive</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("system")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === "system" ? "bg-pink-600 text-white shadow-xs" : "text-text-secondary hover:text-text-primary hover:bg-[#0f131c]"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Sistema</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 min-h-[340px] max-h-[50vh] space-y-5">
          {activeTab === "ai" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-pink-500" />
                  <span>Configuração da IA</span>
                </h3>
                <p className="text-xs text-text-secondary leading-normal">
                  Cole sua chave do Gemini, teste a conexão e o sistema passa a usar essa credencial automaticamente nas funções de IA.
                </p>
              </div>

              <div className="p-4 bg-pink-500/5 border border-pink-500/30 rounded-xl space-y-3.5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-pink-500" />
                    <span>Chave de API do Google Gemini</span>
                  </label>
                  <input
                    type="password"
                    value={formData.geminiApiKey || ""}
                    onChange={(e) => {
                      setFormData({ ...formData, geminiApiKey: e.target.value });
                      setAiTestResult(null);
                    }}
                    className="w-full px-3 py-2.5 bg-[#0f131c] border border-pink-500/30 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-shadow"
                    placeholder="Cole sua API Key do Google AI Studio (AIzaSy...)"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleTestGemini}
                  disabled={isTestingAi || !(formData.geminiApiKey || "").trim()}
                  className="w-full py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingAi ? "animate-spin" : ""}`} />
                  <span>{isTestingAi ? "Validando chave com Gemini..." : "Testar e Ativar Gemini"}</span>
                </button>

                {aiTestResult && (
                  <div
                    className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                      aiTestResult.success
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {aiTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div className="text-[11px] leading-relaxed">{aiTestResult.message}</div>
                  </div>
                )}

                <div className="text-[11px] text-pink-200 leading-relaxed bg-pink-500/10 p-3 rounded-lg border border-pink-500/20">
                  <p className="font-bold mb-1">🔐 Armazenamento da chave</p>
                  <p>
                    No aplicativo desktop, a chave é protegida pelo armazenamento seguro do sistema operacional. No modo web local, ela é criptografada antes de ser persistida.
                  </p>
                  <p className="mt-2">
                    Para obter uma chave, acesse o <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-pink-500 hover:text-text-primary underline font-semibold">Google AI Studio</a> e use a opção <strong>Get API Key</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "obsidian" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-pink-500" />
                  <span>Conexão com o Obsidian</span>
                </h3>
                <p className="text-xs text-text-secondary leading-normal">
                  Configure os parâmetros do Obsidian. No modo Web (navegador), as restrições de segurança de rede do navegador impedem o acesso direto ao seu disco físico, mas o sistema simula o salvamento local para que você use todos os recursos normalmente!
                </p>
              </div>

              {!window.electronAPI && (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/25 text-[11px] text-purple-300 leading-normal">
                  <span className="font-bold block text-purple-200 mb-0.5">ℹ️ Sincronização em Modo Web:</span>
                  O sistema salva todas as notas localmente de forma segura na memória do seu navegador. Para organizar no seu Obsidian físico:
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    <li>Configure o <strong>Nome do Cofre (Vault)</strong> abaixo com o nome exato do seu cofre no Obsidian (ex: GESTOR DE MARKETING - NISTI) para abrir as notas diretamente com um clique.</li>
                    <li>Use os novos botões de <strong>Baixar Nota (.md)</strong> para obter o arquivo de Markdown e arrastá-lo diretamente para a pasta do seu cofre!</li>
                  </ul>
                </div>
              )}

              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-pink-500" />
                      <span>Endpoint REST API</span>
                    </label>
                    <input
                      type="text"
                      value={formData.endpoint}
                      onChange={(e) => {
                        api.disconnectObsidianSession("Endpoint do Obsidian alterado; valide novamente a conexão.");
                        setFormData({ ...formData, endpoint: e.target.value, connectionStatus: "disconnected" });
                        setTestResult(null);
                      }}
                      className="w-full px-3 py-2 bg-[#0f131c] border border-outline-border rounded-lg text-xs font-mono focus:outline-none focus:border-pink-500"
                      placeholder="https://127.0.0.1:27124"
                    />
                    {!window.electronAPI && (
                      <p className="mt-1 text-[10px] text-text-secondary">
                        💡 No navegador, o Obsidian usa HTTPS. Se necessário,{" "}
                        <a
                          href={formData.endpoint ? `${formData.endpoint.replace(/\/+$/, '')}/` : "https://127.0.0.1:27124/"}
                          target="_blank"
                          rel="noreferrer"
                          className="text-pink-400 hover:underline font-semibold"
                        >
                          abra este link
                        </a>{" "}
                        e clique em "Avançado" → "Prosseguir" para aceitar o certificado.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <FolderOpen className="w-3.5 h-3.5 text-pink-500" />
                      <span>Nome do Cofre (Vault)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.vaultName}
                      onChange={(e) => setFormData({ ...formData, vaultName: e.target.value })}
                      className="w-full px-3 py-2 bg-[#0f131c] border border-outline-border rounded-lg text-xs focus:outline-none focus:border-pink-500"
                      placeholder="MarketingVault"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-pink-500" />
                    <span>Chave de Autenticação / Token</span>
                  </label>
                  <input
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) => {
                      api.disconnectObsidianSession("Token do Obsidian alterado; valide novamente a conexão.");
                      setFormData({ ...formData, apiKey: e.target.value, connectionStatus: "disconnected" });
                      setTestResult(null);
                    }}
                    className="w-full px-3 py-2 bg-[#0f131c] border border-outline-border rounded-lg text-xs font-mono focus:outline-none focus:border-pink-500"
                    placeholder="Cole o Bearer Token gerado pelo plugin"
                  />
                </div>

                <div className="bg-[#0f131c] border border-outline-border rounded-xl p-3 text-[11px] text-text-secondary leading-normal">
                  <span className="font-bold text-text-primary block mb-0.5">Plugin recomendado:</span>
                  <span>Instale o plugin <strong>Local REST API</strong> no Obsidian Community Plugins para sincronizar de forma nativa e segura.</span>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleTestObsidian}
                    disabled={isTesting || (!window.electronAPI && (!(formData.endpoint || "").trim() || !(formData.apiKey || "").trim()))}
                    className="w-full py-2.5 bg-[#0f131c] hover:bg-[#334155] disabled:opacity-50 disabled:cursor-not-allowed text-text-primary text-xs font-semibold rounded-lg border border-outline-border transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? "animate-spin text-pink-500" : ""}`} />
                    <span>{isTesting ? "Testando Conexão..." : "Testar, Conectar e Salvar Obsidian"}</span>
                  </button>

                  {testResult && (
                    <div
                      className={`mt-2.5 p-3 rounded-lg border text-xs flex items-start gap-2 ${
                        testResult.success
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      }`}
                    >
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div className="text-[11px] leading-relaxed">{testResult.message}</div>
                    </div>
                  )}

                  {testResult && !testResult.success && (
                    <div className="mt-3 p-3 bg-pink-500/10 border border-pink-500/30 rounded-xl text-left">
                      <p className="text-[11px] text-text-primary leading-relaxed font-medium">
                        A conexão não foi liberada. No desktop, confirme que o Obsidian está aberto, o plugin Local REST API está ativo, o token está correto e a pasta física do Vault foi selecionada.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "drive" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-pink-500" />
                  <span>Login com Google Drive</span>
                </h3>
                <p className="text-xs text-text-secondary leading-normal">
                  Conecte sua conta do Google Drive para importar de maneira segura briefings, manuais, roteiros e planilhas diretamente da nuvem.
                </p>
              </div>

              {driveError && (
                <div className="p-3 bg-red-500/10 text-red-400 border border-red-500/30 rounded-xl flex items-start gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{driveError}</span>
                </div>
              )}

              {isDriveConnected ? (
                <div className="p-6 text-center bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/30">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-emerald-400">Google Drive Conectado</h4>
                    <p className="text-[11px] text-emerald-500 max-w-sm mx-auto leading-normal">
                      Sua conta do Google está autenticada. Você já pode pesquisar e carregar documentos direto na tela de Curadoria do PKM.
                    </p>
                  </div>
                  <button
                    onClick={handleDisconnectDrive}
                    className="px-4 py-2 bg-surface-card hover:bg-red-500/10 hover:text-red-400 text-text-secondary border border-outline-border text-xs font-bold rounded-lg transition-colors flex items-center gap-2 mx-auto cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Desconectar Conta Google</span>
                  </button>
                </div>
              ) : (
                <div className="p-6 text-center bg-[#0f131c] border border-outline-border rounded-xl space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto border border-blue-500/30">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-text-primary">Entrar com sua conta Google</h4>
                    <p className="text-[11px] text-text-secondary max-w-sm mx-auto leading-normal">
                      Ao fazer login, o sistema ganha acesso somente-leitura e seguro para que você selecione e importe seus briefings ou criativos em nuvem.
                    </p>
                  </div>
                  <button
                    onClick={handleConnectDrive}
                    disabled={driveLoading}
                    className="px-5 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 mx-auto cursor-pointer disabled:opacity-50"
                  >
                    {driveLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                    <span>Conectar Google Drive</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "system" && (
            <div className="space-y-5 animate-fadeIn">
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-pink-500" />
                  <span>Gerenciamento de Sistema</span>
                </h3>
                <p className="text-xs text-text-secondary leading-normal">
                  Exporte cópias de segurança do seu banco de dados local ou limpe e redefina as configurações do sistema de volta aos padrões originais de fábrica.
                </p>
              </div>

              <div className="p-4 bg-[#0f131c] border border-outline-border rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Backup e Cópia de Segurança</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onExportVault}
                    className="flex items-center gap-1.5 px-3 py-2 bg-surface-card hover:bg-[#0f131c] text-text-secondary text-xs font-semibold rounded-lg transition-colors border border-outline-border cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar Banco Local (JSON)</span>
                  </button>

                  <label className="flex items-center gap-1.5 px-3 py-2 bg-surface-card hover:bg-[#0f131c] text-text-secondary text-xs font-semibold rounded-lg transition-colors border border-outline-border cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Importar Banco de Dados</span>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          onImportVault(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {onClearAllData && (
                <div className="p-4 border border-rose-500/20 bg-rose-500/10 rounded-xl flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-rose-400 block">Zerar de Fábrica (Reset Total)</span>
                    <span className="text-[11px] text-text-secondary block leading-normal">
                      Apaga permanentemente todo o cache local e remove credenciais do sistema, iniciando o sistema vazio de fábrica.
                    </span>
                  </div>
                  {confirmClear ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onClearAllData();
                          setConfirmClear(false);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        Resetar Agora
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClear(false)}
                        className="px-2.5 py-1.5 text-text-secondary hover:text-text-primary text-[11px] bg-[#0f131c] border border-outline-border rounded-lg font-semibold cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClear(true)}
                      className="flex items-center gap-1.5 px-3 py-2 text-rose-500 hover:bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Zerar Tudo</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-outline-border bg-[#1c2028] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-[#334155] hover:bg-[#475569] text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  );
};
