import React, { useState } from "react";
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
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { ObsidianApiConfig } from "../types";

interface ObsidianApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ObsidianApiConfig;
  onSaveConfig: (newConfig: ObsidianApiConfig) => void;
  onTestConnection: (cfg: ObsidianApiConfig) => Promise<{ success: boolean; message: string }>;
  onExportVault: () => void;
  onImportVault: (file: File) => void;
}

export const ObsidianApiSettingsModal: React.FC<ObsidianApiSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onTestConnection,
  onExportVault,
  onImportVault,
}) => {
  const [formData, setFormData] = useState<ObsidianApiConfig>({ ...config });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await onTestConnection(formData);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Erro desconhecido ao testar conexão",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    onSaveConfig(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <Settings className="w-4 h-4 text-purple-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">
                Configuração da API do Obsidian
              </h2>
              <p className="text-xs text-stone-500">
                Conexão com o plugin Obsidian Local REST API & Advanced URI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Quick Setup Guide */}
          <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-3.5 text-xs text-stone-700 space-y-1.5">
            <h4 className="font-bold text-purple-900 flex items-center gap-1.5">
              <span>Como habilitar a API no seu aplicativo Obsidian:</span>
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-stone-600 pl-1">
              <li>No Obsidian Desktop, vá em <strong>Settings &gt; Community Plugins</strong>.</li>
              <li>Busque e instale o plugin <strong>Local REST API</strong> (autor: coddingtonbear).</li>
              <li>Habilite o plugin e copie o <strong>API Key</strong> gerado nas configurações dele.</li>
              <li>Cole a chave e a porta correspondente abaixo para sincronização automática.</li>
            </ol>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-purple-600" />
                <span>Endpoint REST API do Obsidian</span>
              </label>
              <input
                type="text"
                value={formData.endpoint}
                onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-mono focus:outline-none focus:border-purple-500"
                placeholder="http://127.0.0.1:27124 ou https://127.0.0.1:27124"
              />
              <span className="text-[10px] text-stone-400 mt-1 block">
                Padrão do plugin: <code>http://127.0.0.1:27124</code> ou <code>https://127.0.0.1:27124</code>
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-purple-600" />
                <span>API Key / Token de Autenticação</span>
              </label>
              <input
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-mono focus:outline-none focus:border-purple-500"
                placeholder="Cole o Bearer Token gerado pelo plugin"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-purple-600" />
                <span>Nome do Cofre (Vault Name)</span>
              </label>
              <input
                type="text"
                value={formData.vaultName}
                onChange={(e) => setFormData({ ...formData, vaultName: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-purple-500"
                placeholder="MarketingVault ou nome do seu cofre"
              />
              <span className="text-[10px] text-stone-400 mt-1 block">
                Utilizado para gerar links Obsidian URI diretos (<code>obsidian://open?vault=...</code>)
              </span>
            </div>

            {/* Test Connection Button & Status */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting}
                className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-lg border border-stone-300 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? "animate-spin text-purple-600" : ""}`} />
                <span>{isTesting ? "Testando Conexão com Obsidian..." : "Testar Conexão com REST API"}</span>
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

            {/* Backup & Import Options */}
            <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={onExportVault}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-lg transition-colors border border-stone-200"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Cofre (JSON)</span>
              </button>

              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-lg transition-colors border border-stone-200 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Importar Cofre</span>
                <input
                  type="file"
                  accept=".json,.md"
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
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-stone-100 bg-stone-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  );
};
