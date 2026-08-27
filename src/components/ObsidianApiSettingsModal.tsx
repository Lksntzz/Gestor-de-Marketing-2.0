import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  Cloud,
  Download,
  FolderOpen,
  HardDrive,
  Key,
  Loader2,
  RefreshCw,
  Save,
  Settings,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { ObsidianApiConfig } from "../types";
import { api } from "../services/api";
import { googleDriveService } from "../services/googleDriveService";
import { APP_VERSION } from "../utils/reliability";

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
  const [formData, setFormData] = useState<ObsidianApiConfig>({ ...config });
  const [vaultPath, setVaultPath] = useState<string>("");
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [isTestingObsidian, setIsTestingObsidian] = useState(false);
  const [aiResult, setAiResult] = useState<{ success: boolean; message: string } | null>(null);
  const [obsidianResult, setObsidianResult] = useState<{ success: boolean; message: string } | null>(null);
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormData({ ...config });
    setAiResult(null);
    setObsidianResult(null);
    setConfirmClear(false);
    setDriveConnected(googleDriveService.isAuthenticated());
    if (window.electronAPI?.getVaultPath) {
      window.electronAPI.getVaultPath().then((path) => setVaultPath(path || "")).catch(() => setVaultPath(""));
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const testGemini = async () => {
    setIsTestingAi(true);
    setAiResult(null);
    try {
      const result = await api.testGeminiConnection(formData.geminiApiKey || "");
      setAiResult(result);
      if (result.success) onSaveConfig({ ...formData });
    } catch (err: any) {
      setAiResult({ success: false, message: err.message || "Falha ao testar Gemini." });
    } finally {
      setIsTestingAi(false);
    }
  };

  const selectVault = async () => {
    if (!window.electronAPI?.selectVault) return;
    const result = await window.electronAPI.selectVault();
    if (result?.vaultPath) setVaultPath(result.vaultPath);
  };

  const testObsidian = async () => {
    setIsTestingObsidian(true);
    setObsidianResult(null);
    try {
      const result = await onTestConnection(formData);
      if (!result.success) {
        const failed = { ...formData, connectionStatus: "error" as const, errorMessage: result.message };
        setFormData(failed);
        setObsidianResult(result);
        return;
      }

      let resolvedPath = vaultPath;
      if (!resolvedPath && window.electronAPI?.selectVault) {
        const selected = await window.electronAPI.selectVault();
        resolvedPath = selected?.vaultPath || "";
        setVaultPath(resolvedPath);
      }

      const connected = { ...formData, connectionStatus: "connected" as const, errorMessage: undefined };
      setFormData(connected);
      onSaveConfig(connected);
      setObsidianResult({
        success: true,
        message: resolvedPath
          ? `Conexão validada. Vault local selecionado: ${resolvedPath}`
          : "Conexão REST validada. Selecione a pasta física do Vault para sincronizar arquivos locais.",
      });
    } catch (err: any) {
      const message = err.message || "Falha ao testar conexão com Obsidian.";
      setFormData((current) => ({ ...current, connectionStatus: "error", errorMessage: message }));
      setObsidianResult({ success: false, message });
    } finally {
      setIsTestingObsidian(false);
    }
  };

  const disconnectObsidian = () => {
    const disconnected = { ...formData, connectionStatus: "disconnected" as const, errorMessage: undefined };
    setFormData(disconnected);
    onSaveConfig(disconnected);
    setObsidianResult({ success: true, message: "Obsidian marcado como desconectado no Nisti Marketing." });
  };

  const connectDrive = async () => {
    setDriveLoading(true);
    setDriveError(null);
    try {
      await googleDriveService.getAccessToken();
      setDriveConnected(true);
    } catch (err: any) {
      setDriveError(err.message || "Falha ao conectar Google Drive.");
      setDriveConnected(false);
    } finally {
      setDriveLoading(false);
    }
  };

  const disconnectDrive = () => {
    googleDriveService.disconnect();
    setDriveConnected(false);
  };

  const saveAndClose = () => {
    onSaveConfig(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0f131c] text-slate-100 font-sans overflow-y-auto">
      <header className="h-16 sticky top-0 z-10 bg-[#0f131c] border-b border-[#334155] px-6 md:px-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-xl font-bold tracking-tight text-[#c7d2fe]">Nisti Marketing</span>
          <span className="hidden sm:inline-flex px-2.5 py-1 border border-[#475569] rounded-full text-[9px] font-bold uppercase tracking-[0.1em] text-cyan-400">● Engine</span>
          <span className={`hidden sm:inline-flex px-2.5 py-1 border border-[#475569] rounded-full text-[9px] font-bold uppercase tracking-[0.1em] ${formData.connectionStatus === "connected" ? "text-emerald-400" : "text-slate-500"}`}>● Sync</span>
        </div>
        <button onClick={onClose} className="w-9 h-9 border border-[#334155] hover:bg-[#1c2028] flex items-center justify-center text-slate-400 hover:text-white" aria-label="Fechar configurações"><X className="w-4 h-4" /></button>
      </header>

      <main className="max-w-[1500px] mx-auto px-6 md:px-8 py-7 space-y-7">
        <div>
          <h1 className="text-2xl font-bold">Configurações do Sistema</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie conexões, credenciais e parâmetros operacionais do workspace.</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SettingsCard title="Motor IA" icon={<Brain className="w-5 h-5 text-cyan-400" />} accent="border-l-cyan-500" status={(formData.geminiApiKey || "").trim() ? "CONFIGURADO" : "SEM CHAVE"} statusClass={(formData.geminiApiKey || "").trim() ? "text-cyan-400" : "text-slate-500"}>
            <p className="settings-description">Credencial do Gemini usada pelas funções de análise, curadoria e geração quando o modo IA está ativo.</p>
            <label className="settings-label">Chave de acesso Gemini</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type="password" value={formData.geminiApiKey || ""} onChange={(event) => { setFormData({ ...formData, geminiApiKey: event.target.value }); setAiResult(null); }} placeholder="AIza..." className="settings-input pl-10 font-mono" />
            </div>
            <div className="flex justify-end mt-4"><button onClick={testGemini} disabled={isTestingAi || !(formData.geminiApiKey || "").trim()} className="settings-secondary disabled:opacity-40">{isTestingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} {isTestingAi ? "Testando..." : "Testar Conexão"}</button></div>
            {aiResult && <ResultBox result={aiResult} />}
          </SettingsCard>

          <SettingsCard title="Cofre Obsidian" icon={<FolderOpen className="w-5 h-5 text-violet-400" />} accent="border-l-violet-600" status={formData.connectionStatus === "connected" ? "CONECTADO" : "DESCONECTADO"} statusClass={formData.connectionStatus === "connected" ? "text-emerald-400" : "text-red-400"}>
            <p className="settings-description">Integração principal de PKM. A conexão REST e a pasta física do Vault precisam estar válidas para leitura e gravação desktop.</p>
            <label className="settings-label">Diretório do Cofre (Vault)</label>
            <div className="flex gap-2"><div className="settings-input flex-1 flex items-center gap-2 text-xs font-mono overflow-hidden"><HardDrive className="w-4 h-4 shrink-0 text-slate-500" /><span className="truncate">{vaultPath || "Nenhuma pasta selecionada"}</span></div><button onClick={selectVault} disabled={!window.electronAPI?.selectVault} className="settings-secondary disabled:opacity-40">Selecionar</button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div><label className="settings-label">Endpoint Local REST API</label><input value={formData.endpoint} onChange={(event) => { setFormData({ ...formData, endpoint: event.target.value, connectionStatus: "disconnected" }); setObsidianResult(null); }} className="settings-input font-mono" /></div>
              <div><label className="settings-label">Nome do Vault</label><input value={formData.vaultName} onChange={(event) => setFormData({ ...formData, vaultName: event.target.value })} className="settings-input" /></div>
            </div>
            <label className="settings-label mt-4">Token de Autenticação</label>
            <input type="password" value={formData.apiKey} onChange={(event) => { setFormData({ ...formData, apiKey: event.target.value, connectionStatus: "disconnected" }); setObsidianResult(null); }} placeholder="Bearer token do Local REST API" className="settings-input font-mono" />
            <div className="flex flex-wrap justify-end gap-2 mt-4">{formData.connectionStatus === "connected" && <button onClick={disconnectObsidian} className="settings-danger">Desconectar</button>}<button onClick={testObsidian} disabled={isTestingObsidian || !formData.endpoint.trim() || !formData.apiKey.trim()} className="settings-primary disabled:opacity-40">{isTestingObsidian ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} {isTestingObsidian ? "Validando..." : "Testar e Conectar"}</button></div>
            {obsidianResult && <ResultBox result={obsidianResult} />}
          </SettingsCard>

          <SettingsCard title="Google Drive" icon={<Cloud className="w-5 h-5 text-amber-400" />} accent="border-l-amber-500" status={driveConnected ? "CONECTADO" : "DESCONECTADO"} statusClass={driveConnected ? "text-emerald-400" : "text-red-400"}>
            <p className="settings-description">Fonte opcional de ingestão em modo somente leitura. O token OAuth fica somente em memória e expira automaticamente.</p>
            <div className="bg-[#263140] border border-[#475569] p-4 flex items-center gap-3">
              <div className={`w-10 h-10 border flex items-center justify-center ${driveConnected ? "border-emerald-600 text-emerald-400" : "border-[#475569] text-slate-500"}`}><Cloud className="w-5 h-5" /></div>
              <div><p className="text-sm font-semibold">{driveConnected ? "Conta conectada" : "Nenhuma conta vinculada"}</p><p className="text-xs text-slate-500 mt-1">{driveConnected ? "Ingestão read-only disponível." : "A ingestão de arquivos do Drive está pausada."}</p></div>
            </div>
            <div className="flex justify-end mt-5">{driveConnected ? <button onClick={disconnectDrive} className="settings-danger">Desconectar Conta</button> : <button onClick={connectDrive} disabled={driveLoading} className="settings-secondary disabled:opacity-40">{driveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />} Conectar Conta</button>}</div>
            {driveError && <ResultBox result={{ success: false, message: driveError }} />}
          </SettingsCard>

          <SettingsCard title="Aplicativo" icon={<Settings className="w-5 h-5 text-slate-300" />} accent="border-l-slate-500" status={`v${APP_VERSION}`} statusClass="text-slate-500">
            <p className="settings-description">Backup, importação e manutenção dos dados locais do Nisti Marketing.</p>
            <div className="space-y-2">
              <button onClick={onExportVault} className="settings-row"><span className="flex items-center gap-2"><Download className="w-4 h-4" /> Exportar Backup do Workspace</span><span className="text-slate-600">JSON</span></button>
              <button onClick={() => importRef.current?.click()} className="settings-row"><span className="flex items-center gap-2"><Upload className="w-4 h-4" /> Importar Backup do Workspace</span><span className="text-slate-600">JSON</span></button>
              <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImportVault(file); event.currentTarget.value = ""; }} />
              {onClearAllData && !confirmClear && <button onClick={() => setConfirmClear(true)} className="settings-row text-red-300"><span className="flex items-center gap-2"><Trash2 className="w-4 h-4" /> Limpar todos os dados locais</span><span className="text-red-500">Perigoso</span></button>}
              {onClearAllData && confirmClear && <div className="p-3 border border-red-800 bg-red-950/20"><p className="text-xs text-red-200">Esta ação apaga o workspace local. O conteúdo físico do seu Vault não é apagado por este botão.</p><div className="flex justify-end gap-2 mt-3"><button onClick={() => setConfirmClear(false)} className="settings-secondary">Cancelar</button><button onClick={() => { onClearAllData(); setConfirmClear(false); }} className="settings-danger">Confirmar Limpeza</button></div></div>}
            </div>
          </SettingsCard>
        </div>

        <div className="border-t border-[#334155] pt-5 flex flex-col sm:flex-row items-center justify-end gap-3">
          <button onClick={onClose} className="h-10 px-5 border border-[#475569] hover:bg-[#1c2028] text-sm font-semibold">Descartar Alterações</button>
          <button onClick={saveAndClose} className="h-10 px-6 bg-[#2563eb] hover:bg-blue-500 text-sm font-semibold flex items-center gap-2"><Save className="w-4 h-4" /> Salvar Configurações</button>
        </div>
      </main>

      <style>{`.settings-label{display:block;margin-bottom:7px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8}.settings-description{font-size:12px;line-height:18px;color:#94a3b8;margin-bottom:20px}.settings-input{width:100%;height:41px;padding-left:12px;padding-right:12px;background:#111827;border:1px solid #475569;color:#e2e8f0;font-size:12px;outline:none}.settings-input:focus{border-color:#3b82f6}.settings-primary,.settings-secondary,.settings-danger{height:38px;padding:0 15px;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:12px;font-weight:600;border:1px solid #475569}.settings-primary{background:#2563eb;border-color:#3b82f6;color:white}.settings-primary:hover{background:#3b82f6}.settings-secondary{background:#182234;color:#e2e8f0}.settings-secondary:hover{background:#263140}.settings-danger{background:#111827;border-color:#be123c;color:#fb7185}.settings-row{width:100%;height:42px;padding:0 14px;background:#111827;border:1px solid #475569;display:flex;align-items:center;justify-content:space-between;text-align:left;font-size:12px;color:#e2e8f0}.settings-row:hover{background:#263140}`}</style>
    </div>
  );
};

const SettingsCard: React.FC<{ title: string; icon: React.ReactNode; accent: string; status: string; statusClass: string; children: React.ReactNode }> = ({ title, icon, accent, status, statusClass, children }) => (
  <section className={`bg-[#182234] border border-[#263140] border-l-4 ${accent} rounded-sm p-5 md:p-6`}>
    <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#475569]"><h2 className="text-lg font-semibold flex items-center gap-2">{icon}{title}</h2><span className={`text-[10px] font-bold uppercase tracking-[0.08em] ${statusClass}`}>● {status}</span></div>
    <div className="pt-4">{children}</div>
  </section>
);

const ResultBox: React.FC<{ result: { success: boolean; message: string } }> = ({ result }) => (
  <div className={`mt-4 p-3 border text-xs flex items-start gap-2 ${result.success ? "border-emerald-700 bg-emerald-950/20 text-emerald-300" : "border-amber-700 bg-amber-950/20 text-amber-200"}`}>
    {result.success ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}<span>{result.message}</span>
  </div>
);
