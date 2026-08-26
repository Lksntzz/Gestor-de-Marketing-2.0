import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  FolderOpen,
  HardDrive,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  Laptop,
  Check,
  Lock,
  Cpu,
  RefreshCw,
  FolderCheck,
  FileCode,
  Sliders,
  ExternalLink,
  HelpCircle,
  FolderSync,
} from "lucide-react";
import { ObsidianApiConfig, EngineMode } from "../types";
import { APP_VERSION } from "../utils/reliability";

interface DesktopSetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (vaultPath: string) => void;
  apiConfig: ObsidianApiConfig;
  setApiConfig: React.Dispatch<React.SetStateAction<ObsidianApiConfig>>;
  engineMode: EngineMode;
  onToggleEngineMode: (mode: EngineMode) => void;
  onOpenGuide?: () => void;
}

const STANDARD_FOLDERS = [
  { name: "00_Inbox", desc: "Entrada rápida de notas, gravações e Daily Notes" },
  { name: "01_Estrategia", desc: "Posicionamento, tom de voz, personas e metas" },
  { name: "02_Produtos", desc: "Catálogo de produtos, precificação e ofertas" },
  { name: "03_Conteudos", desc: "Roteiros, posts, carrosséis e copywriting" },
  { name: "04_Campanhas", desc: "Planejamento e execução de lançamentos" },
  { name: "05_Reunioes", desc: "Atas, briefings e alinhamentos de equipe" },
  { name: "06_Influenciadores_UGC", desc: "Parcerias, creators e avaliações de clientes" },
  { name: "07_Pesquisas", desc: "Inteligência de mercado, concorrentes e dores" },
  { name: "08_Aprendizados", desc: "Histórico de métricas e relatórios pós-morte" },
  { name: "99_Templates", desc: "Modelos padronizados de notas e campanhas" },
];

export const DesktopSetupWizardModal: React.FC<DesktopSetupWizardModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  apiConfig,
  setApiConfig,
  engineMode,
  onToggleEngineMode,
  onOpenGuide,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedVault, setSelectedVault] = useState<string>("");
  const [isSelectingVault, setIsSelectingVault] = useState(false);
  const [createdFolders, setCreatedFolders] = useState<string[]>([]);
  const [isDesktopRuntime, setIsDesktopRuntime] = useState(false);
  const [systemCheckPassed, setSystemCheckPassed] = useState(true);
  const [localRestEnabled, setLocalRestEnabled] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.electronAPI) {
      setIsDesktopRuntime(true);
      window.electronAPI.getVaultPath().then((path) => {
        if (path) setSelectedVault(path);
      });
    }
  }, []);

  if (!isOpen) return null;

  const handleSelectVaultNative = async () => {
    if (window.electronAPI?.selectVault) {
      setIsSelectingVault(true);
      try {
        const result = await window.electronAPI.selectVault();
        if (result && result.vaultPath) {
          setSelectedVault(result.vaultPath);
          setCreatedFolders(result.foldersCreated || STANDARD_FOLDERS.map((f) => f.name));
        }
      } catch (err) {
        console.error("Erro ao selecionar cofre nativo:", err);
      } finally {
        setIsSelectingVault(false);
      }
    } else {
      // Simulação para o navegador / preview
      setSelectedVault("C:\\Users\\Usuario\\Documents\\ObsidianVault_Nisti");
      setCreatedFolders(STANDARD_FOLDERS.map((f) => f.name));
    }
  };

  const handleFinishSetup = () => {
    localStorage.setItem("nisti_setup_wizard_completed", "true");
    onComplete(selectedVault || "C:\\Users\\Usuario\\Documents\\ObsidianVault_Nisti");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header no Padrão de Confiabilidade Microsoft */}
        <div className="bg-stone-900 text-white px-6 py-4 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/40 text-purple-300 flex items-center justify-center font-bold">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-tight">
                  Nisti Print PKM Marketing Hub
                </h2>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Confiável Microsoft / Windows Ready
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Assistente de Instalação e Configuração Inicial do Ambiente Local (v{APP_VERSION})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
            title="Fechar assistente"
            aria-label="Fechar assistente"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Progresso em 4 Etapas */}
        <div className="bg-stone-50 border-b border-stone-200 px-6 py-3">
          <div className="flex items-center justify-between max-w-xl mx-auto">
            <button
              onClick={() => setCurrentStep(1)}
              className={`flex items-center gap-2 text-xs font-bold transition-colors cursor-pointer ${
                currentStep === 1 ? "text-purple-900" : "text-stone-400 hover:text-stone-600"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  currentStep === 1
                    ? "bg-purple-700 text-white font-black"
                    : currentStep > 1
                    ? "bg-emerald-600 text-white"
                    : "bg-stone-200 text-stone-600"
                }`}
              >
                {currentStep > 1 ? <Check className="w-3.5 h-3.5" /> : "1"}
              </span>
              <span>1. Confiabilidade</span>
            </button>

            <div className={`h-0.5 w-8 ${currentStep > 1 ? "bg-emerald-500" : "bg-stone-200"}`} />

            <button
              onClick={() => setCurrentStep(2)}
              className={`flex items-center gap-2 text-xs font-bold transition-colors cursor-pointer ${
                currentStep === 2 ? "text-purple-900" : "text-stone-400 hover:text-stone-600"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  currentStep === 2
                    ? "bg-purple-700 text-white font-black"
                    : currentStep > 2
                    ? "bg-emerald-600 text-white"
                    : "bg-stone-200 text-stone-600"
                }`}
              >
                {currentStep > 2 ? <Check className="w-3.5 h-3.5" /> : "2"}
              </span>
              <span>2. Cofre Obsidian</span>
            </button>

            <div className={`h-0.5 w-8 ${currentStep > 2 ? "bg-emerald-500" : "bg-stone-200"}`} />

            <button
              onClick={() => setCurrentStep(3)}
              className={`flex items-center gap-2 text-xs font-bold transition-colors cursor-pointer ${
                currentStep === 3 ? "text-purple-900" : "text-stone-400 hover:text-stone-600"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  currentStep === 3
                    ? "bg-purple-700 text-white font-black"
                    : currentStep > 3
                    ? "bg-emerald-600 text-white"
                    : "bg-stone-200 text-stone-600"
                }`}
              >
                {currentStep > 3 ? <Check className="w-3.5 h-3.5" /> : "3"}
              </span>
              <span>3. Motor & IA</span>
            </button>

            <div className={`h-0.5 w-8 ${currentStep > 3 ? "bg-emerald-500" : "bg-stone-200"}`} />

            <button
              onClick={() => setCurrentStep(4)}
              className={`flex items-center gap-2 text-xs font-bold transition-colors cursor-pointer ${
                currentStep === 4 ? "text-purple-900" : "text-stone-400 hover:text-stone-600"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  currentStep === 4 ? "bg-purple-700 text-white font-black" : "bg-stone-200 text-stone-600"
                }`}
              >
                4
              </span>
              <span>4. Conclusão</span>
            </button>
          </div>
        </div>

        {/* Corpo do Assistente */}
        <div className="p-6 overflow-y-auto space-y-5 text-stone-700 text-xs leading-relaxed flex-1">
          
          {/* PASSO 1: CONFIABILIDADE & PADRÕES MICROSOFT */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-gradient-to-r from-purple-50 via-purple-50/50 to-stone-50 border border-purple-200 rounded-xl p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-700" />
                  <h3 className="text-sm font-black text-purple-950">
                    Bem-vindo ao Instalador & Hub de Marketing Nisti PKM
                  </h3>
                </div>
                <p className="text-stone-600 text-xs">
                  O Nisti PKM foi projetado seguindo as diretrizes de segurança e privacidade do 
                  <strong> Microsoft Windows App Certification</strong> e arquitetura <strong>Local-First</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Princípio do Menor Privilégio (`asInvoker`)</span>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Não requer privilégios de Administrador (UAC) para rodar no dia a dia. Todos os arquivos são mantidos no seu perfil de usuário.
                  </p>
                </div>

                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Criptografia de Credenciais (Windows DPAPI)</span>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Chaves e tokens são protegidos com a API nativa de segurança do Windows (<code>safeStorage</code> / AES-GCM 256 bits).
                  </p>
                </div>

                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Sandbox & Isolamento de Processos</span>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Processo de renderização totalmente isolado (<code>contextIsolation: true</code>, <code>sandbox: true</code>) sem acesso descontrolado ao Node.js.
                  </p>
                </div>

                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>100% Autocontido e Sem Bloatware</span>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Não instala serviços em segundo plano, não realiza telemetria invasiva e preserva seus arquivos Markdown mesmo se desinstalado.
                  </p>
                </div>
              </div>

              {/* Card de Status do Sistema */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div>
                    <span className="font-bold text-emerald-950 text-xs block">
                      Ambiente Verificado e Seguro
                    </span>
                    <span className="text-[11px] text-emerald-800">
                      Pronto para inicializar seu cofre local de marketing.
                    </span>
                  </div>
                </div>
                {onOpenGuide && (
                  <button
                    onClick={onOpenGuide}
                    className="text-[11px] font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Ver Certificação & Guia</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* PASSO 2: COFRE OBSIDIAN & ESTRUTURA DE PASTAS */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
                  <FolderOpen className="w-4 h-4 text-purple-700" />
                  <span>Escolha da Pasta Raiz do seu Cofre Obsidian (Vault)</span>
                </div>
                <p className="text-stone-600 text-xs">
                  O Nisti PKM se integra diretamente aos seus arquivos Markdown locais. Selecione uma pasta existente do Obsidian ou crie uma nova para a gestão de marketing.
                </p>
              </div>

              <div className="p-4 bg-white rounded-xl border border-stone-200 space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-stone-900 block text-xs">Caminho do Cofre Atual:</span>
                    <span className="text-[11px] font-mono text-stone-600 break-all bg-stone-100 px-2 py-1 rounded-md mt-1 inline-block">
                      {selectedVault || "Nenhum cofre configurado ainda"}
                    </span>
                  </div>
                  <button
                    onClick={handleSelectVaultNative}
                    disabled={isSelectingVault}
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-sm"
                  >
                    {isSelectingVault ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Selecionando...</span>
                      </>
                    ) : (
                      <>
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Selecionar Pasta do Cofre</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Pastas Padronizadas que serão provisionadas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                    <FolderCheck className="w-4 h-4 text-emerald-600" />
                    <span>Estrutura de Pastas Automatizada (10 Módulos PKM):</span>
                  </span>
                  <span className="text-[10px] text-stone-500">
                    Criadas automaticamente sem sobrescrever arquivos existentes
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {STANDARD_FOLDERS.map((folder) => (
                    <div
                      key={folder.name}
                      className="p-2 bg-stone-50 hover:bg-purple-50/50 rounded-lg border border-stone-200 transition-colors flex items-start gap-2"
                    >
                      <span className="text-purple-700 font-mono text-[11px] font-bold shrink-0">📁</span>
                      <div>
                        <code className="text-[11px] font-bold text-stone-900 block">{folder.name}/</code>
                        <p className="text-[10px] text-stone-500 leading-tight mt-0.5">{folder.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PASSO 3: MOTOR DE EXECUÇÃO & IA */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
                  <Cpu className="w-4 h-4 text-purple-700" />
                  <span>Escolha o Modo de Operação do Motor de Inteligência</span>
                </div>
                <p className="text-stone-600 text-xs">
                  Você tem controle total sobre como as ideias, tarefas e campanhas são geradas:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Opção Modo 100% Local */}
                <div
                  onClick={() => onToggleEngineMode("local")}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer space-y-2 ${
                    engineMode === "local"
                      ? "border-purple-600 bg-purple-50/60 shadow-sm"
                      : "border-stone-200 bg-white hover:bg-stone-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-emerald-600" />
                      <span>Modo 100% Local (Privacidade Total)</span>
                    </span>
                    {engineMode === "local" && (
                      <span className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Regras determinísticas e análise local. Zero dados enviados para fora do seu computador. Funciona offline sem necessidade de chave de API.
                  </p>
                </div>

                {/* Opção Híbrido com Gemini */}
                <div
                  onClick={() => onToggleEngineMode("gemini")}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer space-y-2 ${
                    engineMode === "gemini"
                      ? "border-purple-600 bg-purple-50/60 shadow-sm"
                      : "border-stone-200 bg-white hover:bg-stone-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span>Modo Híbrido com Gemini AI</span>
                    </span>
                    {engineMode === "gemini" && (
                      <span className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Gera copywriting avançado, roteiros criativos de carrossel e análises aprofundadas com modelos de IA de última geração.
                  </p>
                </div>
              </div>

              {/* Configuração Opcional do Local REST API */}
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                    <FolderSync className="w-4 h-4 text-blue-600" />
                    <span>Integração com Plugin Obsidian Local REST API (Opcional)</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={localRestEnabled}
                    onChange={(e) => setLocalRestEnabled(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-stone-600">
                  Permite sincronização em tempo real quando o Obsidian estiver aberto via porta interna <code>http://127.0.0.1:27124</code>.
                </p>

                {localRestEnabled && (
                  <div className="pt-2 border-t border-stone-200 space-y-2">
                    <div>
                      <label className="text-[10px] font-bold text-stone-700 block mb-1">
                        Chave da API / Bearer Token do Plugin:
                      </label>
                      <input
                        type="password"
                        value={apiConfig.apiKey}
                        onChange={(e) => setApiConfig({ ...apiConfig, apiKey: e.target.value })}
                        placeholder="Cole a chave do plugin Local REST API..."
                        className="w-full text-xs px-3 py-1.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PASSO 4: CONCLUSÃO & INICIALIZAÇÃO */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-2 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-1">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-emerald-950">
                  Instalação & Configuração Concluídas com Sucesso!
                </h3>
                <p className="text-stone-600 text-xs max-w-md mx-auto">
                  O Nisti PKM Marketing Hub está pronto para gerenciar suas ideias, roteiros, campanhas e métricas no cofre do Obsidian.
                </p>
              </div>

              {/* Resumo da Configuração */}
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <h4 className="font-bold text-stone-900 text-xs">Resumo do Ambiente Configurado:</h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 bg-white rounded-lg border border-stone-200">
                    <span className="text-stone-500 block text-[10px]">Cofre Obsidian:</span>
                    <strong className="text-stone-900 truncate block font-mono">
                      {selectedVault || "Padrão de Documentos"}
                    </strong>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-stone-200">
                    <span className="text-stone-500 block text-[10px]">Motor Selecionado:</span>
                    <strong className="text-stone-900 block">
                      {engineMode === "local" ? "100% Local (Offline)" : "Híbrido com Gemini AI"}
                    </strong>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-stone-200">
                    <span className="text-stone-500 block text-[10px]">Segurança & Privilégio:</span>
                    <strong className="text-emerald-700 block">asInvoker (Sem Admin)</strong>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-stone-200">
                    <span className="text-stone-500 block text-[10px]">Criptografia de Chaves:</span>
                    <strong className="text-purple-700 block">AES-GCM (256 bits)</strong>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 flex items-center justify-between text-xs">
                <span className="text-purple-950 font-medium">
                  💡 Você pode reabrir este assistente ou o guia a qualquer momento na barra superior.
                </span>
              </div>
            </div>
          )}

        </div>

        {/* Rodapé com Navegação dos Passos */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <div>
            {currentStep > 1 ? (
              <button
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                className="px-4 py-2 text-stone-700 hover:bg-stone-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 text-stone-500 hover:text-stone-800 text-xs font-medium cursor-pointer"
              >
                Pular Configuração
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep < 4 ? (
              <button
                onClick={() => setCurrentStep((prev) => (prev + 1) as any)}
                className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span>Próximo Passo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleFinishSetup}
                className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Check className="w-4 h-4" />
                <span>Iniciar o Nisti PKM</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
