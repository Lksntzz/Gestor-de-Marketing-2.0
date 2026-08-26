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
      setFormData({ ...config });
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
        onSaveConfig({ ...formData });
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
      if (res.success) {
        const connectedConfig: ObsidianApiConfig = {
          ...formData,
          connectionStatus: "connected",
          errorMessage: undefined,
        };
        setFormData(connectedConfig);
        onSaveConfig(connectedConfig);
      } else {
        setFormData((current) => ({
          ...current,
          connectionStatus: "error",
          errorMessage: res.message,
        }));
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
    onSaveConfig(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/65 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center font-bold">
              <Settings className="w-4 h-4 text-stone-100" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wider text-stone-900">CONFIGURAÇÃO</h2>
              <p className="text-xs text-stone-500">Gerencie IA, conexões locais de cofre e integrações em nuvem</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-stone-100 bg-stone-50/30 p-2 gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === "ai" ? "bg-purple-600 text-white shadow-xs" : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Inteligência Artificial (IA)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("obsidian")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === "obsidian" ? "bg-purple-600 text-white shadow-xs" : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Obsidian</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("drive")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === "drive" ? "bg-purple-600 text-white shadow-xs" : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Google Drive</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("system")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === "system" ? "bg-purple-600 text-white shadow-xs" : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
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
                <h3 className="text-sm font-bold text-stone-950 flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-purple-600" />
                  <span>Configuração da IA</span>
                </h3>
                <p className="text-xs text-stone-500 leading-normal">
                  Cole sua chave do Gemini, teste a conexão e o sistema passa a usar essa credencial automaticamente nas funções de IA.
                </p>
              </div>

              <div className="p-4 bg-purple-50/40 border border-purple-100 rounded-xl space-y-3.5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-purple-700" />
                    <span>Chave de API do Google Gemini</span>
                  </label>
                  <input
                    type="password"
                    value={formData.geminiApiKey || ""}
                    onChange={(e) => {
                      setFormData({ ...formData, geminiApiKey: e.target.value });
                      setAiTestResult(null);
                    }}
                    className="w-full px-3 py-2.5 bg-white border border-purple-250 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-shadow"
                    placeholder="Cole sua API Key do Google AI Studio (AIzaSy...)"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleTestGemini}
                  disabled={isTestingAi || !(formData.geminiApiKey || "").trim()}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingAi ? "animate-spin" : ""}`} />
                  <span>{isTestingAi ? "Validando chave com Gemini..." : "Testar e Ativar Gemini"}</span>
                </button>

                {aiTestResult && (
                  <div
                    className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                      aiTestResult.success
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-amber-50 text-amber-900 border-amber-200"
                    }`}
                  >
                    {aiTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div className="text-[11px] leading-relaxed">{aiTestResult.message}</div>
                  </div>
                )}

                <div className="text-[11px] text-purple-950/80 leading-relaxed bg-purple-50/80 p-3 rounded-lg border border-purple-100/50">
                  <p className="font-bold mb-1">🔐 Armazenamento da chave</p>
                  <p>
                    No aplicativo desktop, a chave é protegida pelo armazenamento seguro do sistema operacional. No modo web local, ela é criptografada antes de ser persistida.
                  </p>
                  <p className="mt-2">
                    Para obter uma chave, acesse o <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-purple-700 hover:text-purple-900 underline font-semibold">Google AI Studio</a> e use a opção <strong>Get API Key</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "obsidian" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-stone-950 flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-purple-600" />
                  <span>Conexão com o Obsidian</span>
                </h3>
                <p className="text-xs text-stone-500 leading-normal">
                  Informe o endpoint e o token do Local REST API. Ao validar, o sistema salva a configuração e passa a sincronizar usando essa conexão.
                </p>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-purple-600" />
                      <span>Endpoint REST API</span>
                    </label>
                    <input
                      type="text"
                      value={formData.endpoint}
                      onChange={(e) => {
                        setFormData({ ...formData, endpoint: e.target.value, connectionStatus: "disconnected" });
                        setTestResult(null);
                      }}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-mono focus:outline-none focus:border-purple-500"
                      placeholder="http://127.0.0.1:27124"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <FolderOpen className="w-3.5 h-3.5 text-purple-600" />
                      <span>Nome do Cofre (Vault)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.vaultName}
                      onChange={(e) => setFormData({ ...formData, vaultName: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-purple-500"
                      placeholder="MarketingVault"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-purple-600" />
                    <span>Chave de Autenticação / Token</span>
                  </label>
                  <input
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) => {
                      setFormData({ ...formData, apiKey: e.target.value, connectionStatus: "disconnected" });
                      setTestResult(null);
                    }}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-mono focus:outline-none focus:border-purple-500"
                    placeholder="Cole o Bearer Token gerado pelo plugin"
                  />
                </div>

                <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-[11px] text-stone-600 leading-normal">
                  <span className="font-bold text-stone-800 block mb-0.5">Plugin recomendado:</span>
                  <span>Instale o plugin <strong>Local REST API</strong> no Obsidian Community Plugins para sincronizar de forma nativa e segura.</span>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleTestObsidian}
                    disabled={isTesting || !formData.endpoint.trim() || !formData.apiKey.trim()}
                    className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 disabled:cursor-not-allowed text-stone-800 text-xs font-semibold rounded-lg border border-stone-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? "animate-spin text-purple-600" : ""}`} />
                    <span>{isTesting ? "Testando Conexão..." : "Testar, Conectar e Salvar Obsidian"}</span>
                  </button>

                  {testResult && (
                    <div
                      className={`mt-2.5 p-3 rounded-lg border text-xs flex items-start gap-2 ${
                        testResult.success
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-amber-50 text-amber-900 border-amber-200"
                      }`}
                    >
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <div className="text-[11px] leading-relaxed">{testResult.message}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "drive" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-stone-950 flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-purple-600" />
                  <span>Login com Google Drive</span>
                </h3>
                <p className="text-xs text-stone-500 leading-normal">
                  Conecte sua conta do Google Drive para importar de maneira segura briefings, manuais, roteiros e planilhas diretamente da nuvem.
                </p>
              </div>

              {driveError && (
                <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl flex items-start gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{driveError}</span>
                </div>
              )}

              {isDriveConnected ? (
                <div className="p-6 text-center bg-emerald-50/40 border border-emerald-150 rounded-xl space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-emerald-900">Google Drive Conectado</h4>
                    <p className="text-[11px] text-emerald-700 max-w-sm mx-auto leading-normal">
                      Sua conta do Google está autenticada. Você já pode pesquisar e carregar documentos direto na tela de Curadoria do PKM.
                    </p>
                  </div>
                  <button
                    onClick={handleDisconnectDrive}
                    className="px-4 py-2 bg-white hover:bg-red-50 hover:text-red-700 text-stone-700 border border-stone-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 mx-auto cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Desconectar Conta Google</span>
                  </button>
                </div>
              ) : (
                <div className="p-6 text-center bg-stone-50 border border-stone-200 rounded-xl space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-stone-900">Entrar com sua conta Google</h4>
                    <p className="text-[11px] text-stone-500 max-w-sm mx-auto leading-normal">
                      Ao fazer login, o sistema ganha acesso somente-leitura e seguro para que você selecione e importe seus briefings ou criativos em nuvem.
                    </p>
                  </div>
                  <button
                    onClick={handleConnectDrive}
                    disabled={driveLoading}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 mx-auto cursor-pointer disabled:opacity-50"
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
                <h3 className="text-sm font-bold text-stone-950 flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-purple-600" />
                  <span>Gerenciamento de Sistema</span>
                </h3>
                <p className="text-xs text-stone-500 leading-normal">
                  Exporte cópias de segurança do seu banco de dados local ou limpe e redefina as configurações do sistema de volta aos padrões originais de fábrica.
                </p>
              </div>

              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Backup e Cópia de Segurança</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onExportVault}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-stone-100 text-stone-700 text-xs font-semibold rounded-lg transition-colors border border-stone-250 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar Banco Local (JSON)</span>
                  </button>

                  <label className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-stone-100 text-stone-700 text-xs font-semibold rounded-lg transition-colors border border-stone-250 cursor-pointer">
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
                <div className="p-4 border border-rose-200/80 bg-rose-50/30 rounded-xl flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-rose-800 block">Zerar de Fábrica (Reset Total)</span>
                    <span className="text-[11px] text-stone-500 block leading-normal">
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
                        className="px-2.5 py-1.5 text-stone-500 hover:text-stone-700 text-[11px] bg-white border border-stone-250 rounded-lg font-semibold cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClear(true)}
                      className="flex items-center gap-1.5 px-3 py-2 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
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

        <div className="p-4 border-t border-stone-100 bg-stone-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  );
};
