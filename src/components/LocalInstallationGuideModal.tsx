import React, { useState } from "react";
import {
  X,
  Laptop,
  FolderSync,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  Sparkles,
  Key,
  Terminal,
  Cloud,
  AlertCircle,
} from "lucide-react";
import { APP_VERSION } from "../utils/reliability";

interface LocalInstallationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

type GuideTab = "installation" | "obsidian" | "updates" | "security";

const STANDARD_FOLDERS = [
  "00_Inbox",
  "01_Estrategia",
  "02_Produtos",
  "03_Conteudos",
  "04_Campanhas",
  "05_Reunioes",
  "06_Influenciadores_UGC",
  "07_Pesquisas",
  "08_Aprendizados",
  "99_Templates",
];

export const LocalInstallationGuideModal: React.FC<LocalInstallationGuideModalProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
}) => {
  const [activeTab, setActiveTab] = useState<GuideTab>("installation");

  if (!isOpen) return null;

  const tabClass = (tab: GuideTab) =>
    `px-3 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
      activeTab === tab
        ? "border-purple-600 text-purple-900 bg-white rounded-t-lg"
        : "border-transparent text-stone-500 hover:text-stone-800"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-fadeIn">
        <div className="p-5 border-b border-stone-150 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-stone-900">Instalação Local & Obsidian</h2>
              <p className="text-xs text-stone-500">Arquitetura desktop, cofre local, configuração e segurança</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200 transition-colors cursor-pointer"
            aria-label="Fechar guia"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-stone-200 bg-stone-50/50 px-5 gap-2 pt-2 overflow-x-auto">
          <button onClick={() => setActiveTab("installation")} className={tabClass("installation")}>
            <HardDrive className="w-3.5 h-3.5" />
            <span>1. Instalação</span>
          </button>
          <button onClick={() => setActiveTab("obsidian")} className={tabClass("obsidian")}>
            <FolderSync className="w-3.5 h-3.5" />
            <span>2. Obsidian</span>
          </button>
          <button onClick={() => setActiveTab("updates")} className={tabClass("updates")}>
            <Sparkles className="w-3.5 h-3.5" />
            <span>3. Atualizações</span>
          </button>
          <button onClick={() => setActiveTab("security")} className={tabClass("security")}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>4. Segurança</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-stone-700 text-xs leading-relaxed">
          {activeTab === "installation" && (
            <div className="space-y-4">
              <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-bold text-purple-950 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-purple-700" />
                  Desktop local com Electron
                </h3>
                <p className="text-stone-600">
                  O pacote final executa o frontend, o processo Electron e um backend HTTP restrito ao loopback da própria máquina. O backend usa uma porta local efêmera no desktop para evitar colisões com outros serviços.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="font-bold text-stone-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Instalador final
                  </span>
                  <p className="text-[11px] text-stone-600 mt-1">
                    Depois de empacotado, o usuário final não precisa instalar Node.js, Bun, Python ou Docker para abrir o aplicativo.
                  </p>
                </div>
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="font-bold text-stone-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Dados locais
                  </span>
                  <p className="text-[11px] text-stone-600 mt-1">
                    O Vault permanece na pasta escolhida por você. Configurações do aplicativo ficam no diretório de dados do usuário do Electron.
                  </p>
                </div>
              </div>

              <div className="bg-stone-100 p-4 rounded-xl border border-stone-200 space-y-2">
                <span className="font-bold text-stone-900 flex items-center gap-2">
                  <Terminal className="w-4 h-4" /> Preparação do instalador a partir do código-fonte
                </span>
                <div className="text-[11px] font-mono text-stone-800 space-y-1">
                  <div><code>bun install --frozen-lockfile</code></div>
                  <div><code>bun run verify</code></div>
                  <div><code>bun run dist</code></div>
                </div>
                <p className="text-[11px] text-stone-600">
                  Os instaladores são gerados em <code>dist-electron/</code>. Para recursos Gemini e Google Drive, configure o arquivo <code>.env</code> antes do build.
                </p>
              </div>
            </div>
          )}

          {activeTab === "obsidian" && (
            <div className="space-y-4">
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4">
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <FolderSync className="w-4 h-4 text-emerald-700" /> Via recomendada: acesso direto ao Vault
                </h3>
                <p className="text-stone-600 mt-1">
                  No desktop, selecione a pasta raiz do seu Vault. O processo principal do Electron mantém essa raiz sob controle e restringe as operações de leitura e gravação ao Vault selecionado.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-stone-50 p-3 rounded-lg border border-stone-200">
                {STANDARD_FOLDERS.map((folder) => (
                  <div key={folder}>📁 <code>{folder}/</code></div>
                ))}
              </div>

              <div className="p-4 bg-white rounded-xl border border-stone-200 space-y-2">
                <h4 className="font-bold text-stone-900">Via opcional: Obsidian Local REST API</h4>
                <p className="text-[11px] text-stone-600">
                  Se quiser usar o plugin Local REST API, mantenha o endpoint no loopback local (por exemplo <code>http://127.0.0.1:27124</code>). A chave do plugin é armazenada com proteção do sistema operacional no desktop.
                </p>
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
                  Configurar Obsidian Local REST API
                </button>
              )}
            </div>
          )}

          {activeTab === "updates" && (
            <div className="space-y-4">
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-700" /> Atualização automática ainda não está implementada
                </h3>
                <p className="text-stone-600">
                  A versão atual não possui Electron Updater ativo. As atualizações devem ser instaladas a partir de um novo pacote validado. O aplicativo não deve anunciar download silencioso ou atualização automática enquanto esse mecanismo não existir no código.
                </p>
              </div>

              <div className="space-y-2 text-[11px]">
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <strong>1.</strong> Exporte um backup sanitizado do workspace antes de atualizar.
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <strong>2.</strong> Feche o aplicativo e instale o novo pacote gerado pelo pipeline validado.
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <strong>3.</strong> Confirme o Vault selecionado e teste a sincronização após a atualização.
                </div>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-4">
              <div className="bg-stone-900 text-white rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400" /> Controles ativos na versão {APP_VERSION}
                </h3>
                <p className="text-stone-300">
                  O backend local aceita conexões apenas pela interface loopback, exige sessão local para as rotas de API e o Electron valida a instância do backend antes de carregar a interface.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="font-bold text-stone-900 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-purple-600" /> Credenciais
                  </span>
                  <p className="text-[11px] text-stone-600 mt-1">
                    No desktop, a chave do Obsidian usa <code>safeStorage</code> do Electron. No runtime web, o armazenamento seguro usa AES-GCM com chave aleatória não extraível persistida via IndexedDB e falha fechado se a criptografia não estiver disponível.
                  </p>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="font-bold text-stone-900 flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 text-blue-600" /> Google Drive
                  </span>
                  <p className="text-[11px] text-stone-600 mt-1">
                    O importador solicita somente acesso de leitura e mantém o access token apenas em memória durante a sessão do aplicativo.
                  </p>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="font-bold text-stone-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Backups
                  </span>
                  <p className="text-[11px] text-stone-600 mt-1">
                    A exportação segura do workspace não inclui a chave da API do Obsidian.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <span className="text-[11px] text-stone-400">Nisti PKM & Marketing Hub v{APP_VERSION}</span>
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
