import React from "react";
import { FolderOpen, Settings, ShieldAlert, Sparkles, CheckSquare, Calendar, HelpCircle } from "lucide-react";

interface ObsidianConnectionBlockerProps {
  onOpenSettings: () => void;
  title: string;
  description: string;
}

export const ObsidianConnectionBlocker: React.FC<ObsidianConnectionBlockerProps> = ({
  onOpenSettings,
  title,
  description,
}) => {
  return (
    <div className="w-full max-w-2xl mx-auto my-12 p-8 bg-white border border-stone-200 rounded-2xl shadow-md animate-fadeIn text-center space-y-6">
      {/* Visual Identity Header */}
      <div className="flex flex-col items-center space-y-3">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center border border-pink-100">
            <svg className="w-8 h-8 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 9L12 22L22 9L12 2ZM12 4.5L18.5 9L12 13.5L5.5 9L12 4.5ZM12 19.5L5 10L12 15L19 10L12 19.5Z" />
            </svg>
          </div>
          <div className="absolute -top-1 -right-1 bg-red-500 text-white p-1 rounded-full border-2 border-white shadow-sm">
            <ShieldAlert className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="space-y-1 mt-2">
          <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-red-100">
            Obsidian Offline
          </span>
          <h2 className="text-xl font-black text-stone-900 tracking-tight">
            {title}
          </h2>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            {description}
          </p>
        </div>
      </div>

      {/* Grid of Blocked Features */}
      <div className="border-t border-b border-stone-100 py-6 text-left max-w-md mx-auto space-y-4">
        <h3 className="text-xs font-bold text-stone-700 uppercase tracking-widest text-center">
          Recursos Bloqueados por Segurança
        </h3>
        
        <div className="grid grid-cols-1 gap-3 text-xs">
          <div className="flex items-start gap-2.5 p-2.5 bg-stone-50 rounded-xl border border-stone-100">
            <FolderOpen className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-stone-850">Leitura &amp; Gravação de Notas</h4>
              <p className="text-stone-500 text-[11px] mt-0.5">Sua base de conhecimento e diretrizes oficiais de marketing estão inacessíveis offline.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2.5 bg-stone-50 rounded-xl border border-stone-100">
            <Sparkles className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-stone-850">Geração Inteligente de Campanhas</h4>
              <p className="text-stone-500 text-[11px] mt-0.5">Não é possível sintetizar ou modelar novas pautas sem validação do cofre real.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2.5 bg-stone-50 rounded-xl border border-stone-100">
            <CheckSquare className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-stone-850">Execução &amp; Quadro Kanban</h4>
              <p className="text-stone-500 text-[11px] mt-0.5">O controle de tarefas não exibe nem grava pendências para evitar duplicações no Obsidian Tasks.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2.5 bg-stone-50 rounded-xl border border-stone-100">
            <Calendar className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-stone-850">Planejamento Diário &amp; Rotinas</h4>
              <p className="text-stone-500 text-[11px] mt-0.5">Inclusão automática de cronogramas e pautas em notas diárias (Daily Notes) está desativada.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={onOpenSettings}
          className="w-full sm:w-auto px-6 py-2.5 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Settings className="w-4 h-4 text-pink-200" />
          <span>Configurar Conexão do Obsidian</span>
        </button>
        
        <a
          href="https://github.com/vrtmrz/obsidian-local-rest-api"
          target="_blank"
          rel="referrer noopener"
          className="w-full sm:w-auto px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <HelpCircle className="w-4 h-4 text-stone-500" />
          <span>Como instalar REST API</span>
        </a>
      </div>

      <div className="text-[10px] text-stone-400 font-medium">
        Garantimos a segurança dos seus dados: nenhuma informação é enviada ou salva de forma fictícia.
      </div>
    </div>
  );
};
