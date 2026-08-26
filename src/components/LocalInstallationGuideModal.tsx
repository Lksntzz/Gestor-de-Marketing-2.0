import React, { useState } from "react";
import {
  X,
  Laptop,
  FolderSync,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  Cpu,
  ArrowRight,
  HelpCircle,
  ExternalLink,
  Layers,
  Terminal,
  FileCode,
  FolderOpen,
  Key,
} from "lucide-react";

interface LocalInstallationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

type GuideTab = "installation" | "obsidian" | "updates" | "security";

export const LocalInstallationGuideModal: React.FC<LocalInstallationGuideModalProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
}) => {
  const [activeTab, setActiveTab] = useState<GuideTab>("installation");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-fadeIn">
        {/* Modal Header */}
        <div className="p-5 border-b border-stone-150 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-stone-900">
                Guia de Instalação Local & Integração Obsidian
              </h2>
              <p className="text-xs text-stone-500">
                Funcionamento local, conexão com o cofre e atualizações contínuas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-stone-200 bg-stone-50/50 px-5 gap-2 pt-2">
          <button
            onClick={() => setActiveTab("installation")}
            className={`px-3 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === "installation"
                ? "border-purple-600 text-purple-900 bg-white rounded-t-lg"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>1. Instalação Local</span>
          </button>
          <button
            onClick={() => setActiveTab("obsidian")}
            className={`px-3 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === "obsidian"
                ? "border-purple-600 text-purple-900 bg-white rounded-t-lg"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <FolderSync className="w-3.5 h-3.5" />
            <span>2. Conexão Obsidian</span>
          </button>
          <button
            onClick={() => setActiveTab("updates")}
            className={`px-3 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === "updates"
                ? "border-purple-600 text-purple-900 bg-white rounded-t-lg"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>3. Atualizações Automáticas</span>
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`px-3 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === "security"
                ? "border-purple-600 text-purple-900 bg-white rounded-t-lg"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Segurança & Criptografia</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-stone-700 text-xs leading-relaxed">
          {/* TAB 1: INSTALAÇÃO LOCAL */}
          {activeTab === "installation" && (
            <div className="space-y-4">
              <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-bold text-purple-950 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-purple-700" />
                  <span>Como o sistema roda na sua máquina (Desktop Standalone)</span>
                </h3>
                <p className="text-stone-600 text-xs">
                  O aplicativo foi construído com arquitetura <strong>Electron + Vite Desktop</strong>, empacotando todo o motor do sistema em um executável nativo leve e rápido.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                  <span className="font-bold text-stone-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Instalador Único (.exe / .dmg / .AppImage)</span>
                  </span>
                  <p className="text-[11px] text-stone-600">
                    Basta executar o instalador padrão do seu sistema operacional. O instalador configura o aplicativo sem criar serviços em segundo plano desnecessários.
                  </p>
                </div>

                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                  <span className="font-bold text-stone-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Zero Dependências Externas</span>
                  </span>
                  <p className="text-[11px] text-stone-600">
                    Você <strong>não</strong> precisa instalar Node.js, Python, Docker ou banco de dados relacional. Todo o ambiente é autocontido e isolado em sandbox.
                  </p>
                </div>

                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                  <span className="font-bold text-stone-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Diretório Padrão de Dados</span>
                  </span>
                  <p className="text-[11px] text-stone-600">
                    Configurações e cache ficam salvos na pasta de aplicativo do usuário (<code>%APPDATA%</code> no Windows, <code>~/Library/Application Support</code> no Mac).
                  </p>
                </div>

                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                  <span className="font-bold text-stone-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Modo 100% Offline / Local</span>
                  </span>
                  <p className="text-[11px] text-stone-600">
                    Quando operando em Modo Local, todas as análises e formatações de notas são realizadas diretamente pelo motor local sem enviar dados para a internet.
                  </p>
                </div>
              </div>

              <div className="bg-stone-100 p-3.5 rounded-xl border border-stone-200 text-[11px] font-mono text-stone-800">
                <span className="font-bold text-stone-900 block mb-1 font-sans">Comandos de Empacotamento Desktop:</span>
                <code>npm run electron:build</code> → Gera instaladores finais na pasta <code>dist_electron/</code>
              </div>
            </div>
          )}

          {/* TAB 2: CONEXÃO COM O OBSIDIAN */}
          {activeTab === "obsidian" && (
            <div className="space-y-4">
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <FolderSync className="w-4 h-4 text-emerald-700" />
                  <span>Como o sistema reconhece e conecta no Obsidian</span>
                </h3>
                <p className="text-stone-600 text-xs">
                  O sistema possui duas vias complementares de reconhecimento e integração com o seu cofre:
                </p>
              </div>

              {/* OPÇÃO 1 */}
              <div className="p-4 bg-white rounded-xl border border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-mono">VIA 1</span>
                    <span>Acesso Direto ao Cofre (Arquivos Markdown .md)</span>
                  </h4>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Nativo Desktop
                  </span>
                </div>
                <p className="text-[11px] text-stone-600">
                  Ao abrir o aplicativo pela primeira vez, você pode selecionar a pasta raiz do seu cofre do Obsidian (ex: <code>D:/Documentos/ObsidianVault</code>). O sistema lê e grava diretamente nos arquivos <code>.md</code> das pastas padrão:
                </p>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                  <div>📁 <code>00_Inbox/Daily-YYYY-MM-DD.md</code></div>
                  <div>📁 <code>01_Estrategia/</code></div>
                  <div>📁 <code>02_Inteligencia_Mercado/</code></div>
                  <div>📁 <code>04_Campanhas/</code></div>
                </div>
              </div>

              {/* OPÇÃO 2 */}
              <div className="p-4 bg-white rounded-xl border border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-mono">VIA 2</span>
                    <span>Obsidian Local REST API (Sincronização em Tempo Real)</span>
                  </h4>
                  <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    Plugin REST
                  </span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-stone-600 pl-1">
                  <li>No Obsidian, instale o plugin comunitário <strong>Local REST API</strong>.</li>
                  <li>Ative o plugin e copie o <strong>API Key / Bearer Token</strong> gerado.</li>
                  <li>O Obsidian passa a escutar exclusivamente no endereço interno <code>http://127.0.0.1:27124</code>.</li>
                  <li>O aplicativo envia as novas notas e tarefas instantaneamente para o Obsidian aberto.</li>
                </ol>
              </div>

              {onOpenSettings && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenSettings();
                  }}
                  className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Key className="w-4 h-4 text-purple-400" />
                  <span>Configurar Endpoint & Chave da API do Obsidian</span>
                </button>
              )}
            </div>
          )}

          {/* TAB 3: ATUALIZAÇÕES AUTOMÁTICAS */}
          {activeTab === "updates" && (
            <div className="space-y-4">
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-700" />
                  <span>Como o sistema recebe atualizações sem desinstalar</span>
                </h3>
                <p className="text-stone-600 text-xs">
                  O sistema utiliza o motor <strong>Electron Updater</strong> integrado a lançamentos de versões contínuas (GitHub Releases / CDN):
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3.5 bg-stone-50 rounded-xl border border-stone-200">
                  <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 text-xs">Checagem Silenciosa de Versão</h4>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      Ao iniciar ou periodicamente, o app consulta o manifesto da versão mais recente em segundo plano.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 bg-stone-50 rounded-xl border border-stone-200">
                  <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 text-xs">Download em Background (Sem Travamentos)</h4>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      Se houver uma versão mais nova com novos recursos, apenas o pacote delta é baixado silenciosamente sem interromper suas notas.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 bg-stone-50 rounded-xl border border-stone-200">
                  <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 text-xs">Aplicação Automática (Hot Swap)</h4>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      Quando o download termina, o aplicativo é atualizado automaticamente na próxima reinicialização — <strong>sem você precisar desinstalar e reinstalar</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-bold text-emerald-950 text-xs">Preservação Total dos Dados</h4>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      O processo de atualização substitui apenas os arquivos executáveis do programa. Todo o cofre de notas, chaves criptografadas e tarefas são 100% preservados no banco local.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SEGURANÇA & CRIPTOGRAFIA */}
          {activeTab === "security" && (
            <div className="space-y-4">
              <div className="bg-stone-900 text-white rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <span>Blindagem Arquitetural de Dados</span>
                </h3>
                <p className="text-stone-300 text-xs">
                  Privacidade em primeiro lugar: todo o armazenamento de credenciais é blindado no navegador e no desktop.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                  <span className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-purple-600" />
                    <span>Criptografia AES-GCM (256 bits)</span>
                  </span>
                  <p className="text-[11px] text-stone-600">
                    A chave de API do Obsidian é criptografada com a Web Cryptography API (<code>crypto.subtle</code>) e nunca fica exposta em texto puro no disco.
                  </p>
                </div>

                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                  <span className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Proteção SSRF & Isolamento de Rede</span>
                  </span>
                  <p className="text-[11px] text-stone-600">
                    URLs capturadas são validadas estritamente e bloqueiam qualquer acesso a IPs privados, portas não padrão ou endpoints de nuvem.
                  </p>
                </div>

                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                  <span className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-blue-600" />
                    <span>Exportações Sanitizadas</span>
                  </span>
                  <p className="text-[11px] text-stone-600">
                    Backups exportados em JSON removem automaticamente tokens e chaves privadas para evitar vazamentos acidentais.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <span className="text-[11px] text-stone-400">
            Nisti PKM & Marketing Hub v2.0.0 Desktop Ready
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
