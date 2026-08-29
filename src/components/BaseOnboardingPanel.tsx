import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, ShieldCheck, X } from "lucide-react";
import type { ObsidianNote } from "../types";
import {
  BASE_FOLDER,
  BASE_ONBOARDING_SECTIONS,
  BASE_ONBOARDING_STORAGE_KEY,
  assessBaseReadiness,
  buildBaseDocumentPlans,
  collectPendingQuestions,
  createEmptyBaseOnboardingDraft,
  type BaseEpistemicStatus,
  type BaseOnboardingDraft,
} from "../domain/baseOnboarding";
import { api } from "../services/api";
import { replacePersistentAppState } from "../services/persistentStateBridge";
import { APP_STATE_KEYS, StorageManager } from "../services/storage/StorageManager";

interface BaseOnboardingPanelProps {
  notes: ObsidianNote[];
  isConnected: boolean;
}

const storage = StorageManager.getInstance();
const STATUS_OPTIONS: BaseEpistemicStatus[] = ["CONFIRMADO", "HIPÓTESE", "PENDENTE"];

function loadDraft(): BaseOnboardingDraft {
  const fallback = createEmptyBaseOnboardingDraft();
  const stored = storage.loadAppState<unknown>(BASE_ONBOARDING_STORAGE_KEY, fallback);
  if (!stored || typeof stored !== "object") return fallback;
  const candidate = stored as Partial<BaseOnboardingDraft>;
  if (candidate.version !== 1 || !candidate.answers || typeof candidate.answers !== "object") return fallback;
  return {
    version: 1,
    currentSectionId: BASE_ONBOARDING_SECTIONS.some((section) => section.id === candidate.currentSectionId)
      ? String(candidate.currentSectionId)
      : fallback.currentSectionId,
    answers: candidate.answers as BaseOnboardingDraft["answers"],
    skippedSectionIds: Array.isArray(candidate.skippedSectionIds)
      ? candidate.skippedSectionIds.filter((id): id is string => typeof id === "string")
      : [],
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : fallback.updatedAt,
  };
}

function statusClass(status: BaseEpistemicStatus): string {
  if (status === "CONFIRMADO") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "HIPÓTESE") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return "border-slate-500/30 bg-slate-500/10 text-slate-300";
}

export const BaseOnboardingPanel: React.FC<BaseOnboardingPanelProps> = ({ notes, isConnected }) => {
  const readiness = useMemo(() => assessBaseReadiness(notes), [notes]);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<BaseOnboardingDraft>(() => loadDraft());
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);

  const currentSectionIndex = Math.max(
    0,
    BASE_ONBOARDING_SECTIONS.findIndex((section) => section.id === draft.currentSectionId)
  );
  const currentSection = BASE_ONBOARDING_SECTIONS[currentSectionIndex];
  const pendingQuestions = useMemo(() => collectPendingQuestions(draft), [draft]);
  const plans = useMemo(() => buildBaseDocumentPlans(draft, notes), [draft, notes]);

  const persistDraft = (next: BaseOnboardingDraft) => {
    const persisted = { ...next, updatedAt: new Date().toISOString() };
    setDraft(persisted);
    storage.saveAppState(BASE_ONBOARDING_STORAGE_KEY, persisted);
  };

  const updateAnswer = (questionId: string, patch: { value?: string; status?: BaseEpistemicStatus }) => {
    const previous = draft.answers[questionId] || { value: "", status: "PENDENTE" as BaseEpistemicStatus };
    persistDraft({
      ...draft,
      answers: {
        ...draft.answers,
        [questionId]: {
          value: patch.value !== undefined ? patch.value : previous.value,
          status: patch.status || previous.status,
        },
      },
    });
  };

  const goToSection = (index: number) => {
    const target = BASE_ONBOARDING_SECTIONS[Math.max(0, Math.min(index, BASE_ONBOARDING_SECTIONS.length - 1))];
    persistDraft({ ...draft, currentSectionId: target.id });
    setShowReview(false);
    setError(null);
  };

  const resetDraft = () => {
    const next = createEmptyBaseOnboardingDraft();
    storage.saveAppState(BASE_ONBOARDING_STORAGE_KEY, next);
    setDraft(next);
    setShowReview(false);
    setError(null);
    setSuccess(null);
  };

  const commitPlans = async () => {
    setError(null);
    setSuccess(null);
    if (!isConnected || !api.isObsidianSessionVerified()) {
      setError("Conecte e valide o Vault antes de gravar a Base Inicial.");
      return;
    }
    if (!window.electronAPI?.commitKnowledge) {
      setError("O Onboarding da Base Inicial exige o aplicativo desktop para garantir gravação canônica sem sobrescrita.");
      return;
    }

    setIsCommitting(true);
    try {
      const folders = await window.electronAPI.listVaultFolders();
      if (!Array.isArray(folders) || !folders.includes(BASE_FOLDER)) {
        throw new Error("A pasta 00_Base ainda não está disponível. Reinicie o aplicativo para atualizar a estrutura padrão do Vault.");
      }

      const latestNotes = await storage.readDesktopNotesForApp();
      const pendingPlans = buildBaseDocumentPlans(draft, latestNotes || []);
      if (pendingPlans.length === 0) {
        throw new Error("Nenhum documento ausente foi encontrado para gravar.");
      }

      let committed = 0;
      for (const plan of pendingPlans) {
        const result = await window.electronAPI.commitKnowledge({
          folder: BASE_FOLDER,
          title: plan.title,
          content: plan.content,
          frontmatter: plan.frontmatter,
          failIfExists: true,
        });
        if (!result?.success || !result.noteRelativePath) {
          throw new Error(result?.error || `O Vault não confirmou a gravação de ${plan.path}.`);
        }
        if (result.noteRelativePath.replace(/\\/g, "/") !== plan.path) {
          throw new Error(`O Vault retornou um caminho inesperado para ${plan.path}. A sequência foi interrompida.`);
        }
        committed += 1;
      }

      await api.syncObsidianSnapshot();
      const refreshed = await storage.readDesktopNotesForApp();
      if (Array.isArray(refreshed)) {
        replacePersistentAppState(APP_STATE_KEYS.NOTES, refreshed);
      }
      localStorage.removeItem(BASE_ONBOARDING_STORAGE_KEY);
      setDraft(createEmptyBaseOnboardingDraft());
      setSuccess(`${committed} documento(s) canônico(s) gravado(s) em 00_Base. A Base foi sincronizada novamente.`);
      setShowReview(false);
    } catch (err: any) {
      setError(err?.message || "A gravação da Base Inicial foi interrompida.");
    } finally {
      setIsCommitting(false);
    }
  };

  if (readiness.complete) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 flex items-center gap-2 text-[11px] text-emerald-900">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span><strong>Base Inicial estruturada.</strong> Os documentos canônicos existem e estão marcados como CONFIRMADO.</span>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-3 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-purple-700">
            <ShieldCheck className="w-3.5 h-3.5" /> Base Inicial
          </div>
          <p className="text-xs font-bold text-stone-900 mt-1">
            {readiness.missingSectionIds.length > 0
              ? `${readiness.missingSectionIds.length} documento(s) canônico(s) ainda não existem.`
              : "Os documentos existem, mas ainda há itens não confirmados."}
          </p>
          <p className="text-[10px] text-stone-600 mt-0.5">
            O onboarding organiza somente informação declarada por você e nunca sobrescreve um arquivo canônico existente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setIsOpen(true); setError(null); setSuccess(null); }}
          disabled={!isConnected}
          className="px-3 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white text-xs font-black shrink-0"
        >
          {storage.loadAppState(BASE_ONBOARDING_STORAGE_KEY, null) ? "Continuar Base Inicial" : "Começar Base Inicial"}
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl border border-outline-border bg-surface-card shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-outline-border flex items-start justify-between gap-3 shrink-0">
              <div>
                <span className="text-[10px] uppercase tracking-[0.18em] font-black text-pink-400">Onboarding da Base Inicial</span>
                <h2 className="text-xl font-black text-text-primary mt-1">Estruturar conhecimento declarado</h2>
                <p className="text-[11px] text-text-secondary mt-1">Sem IA, sem preenchimento automático e sem sobrescrita silenciosa.</p>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="w-9 h-9 rounded-xl border border-outline-border flex items-center justify-center text-text-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden">
              <aside className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-outline-border p-3 overflow-y-auto">
                <div className="space-y-1">
                  {BASE_ONBOARDING_SECTIONS.map((section, index) => {
                    const existing = readiness.existingPaths.some((path) => path === `${BASE_FOLDER}/${section.fileTitle}.md`);
                    return (
                      <button
                        type="button"
                        key={section.id}
                        onClick={() => goToSection(index)}
                        className={`w-full text-left px-3 py-2 rounded-xl border text-xs ${
                          !showReview && index === currentSectionIndex
                            ? "border-pink-500/30 bg-pink-500/10 text-text-primary"
                            : "border-transparent text-text-secondary hover:bg-surface-container-low"
                        }`}
                      >
                        <span className="font-bold block">{index + 1}. {section.title}</span>
                        <span className="text-[9px] opacity-70">{existing ? "Já existe — não será sobrescrito" : "A preencher"}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setShowReview(true)}
                    className={`w-full text-left px-3 py-2 rounded-xl border text-xs ${showReview ? "border-emerald-500/30 bg-emerald-500/10 text-text-primary" : "border-transparent text-text-secondary hover:bg-surface-container-low"}`}
                  >
                    <span className="font-bold block">Revisar e gravar</span>
                    <span className="text-[9px] opacity-70">{plans.length} arquivo(s) ausente(s)</span>
                  </button>
                </div>
              </aside>

              <main className="lg:col-span-9 p-5 overflow-y-auto min-h-0">
                {error && (
                  <div className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-200 flex gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                  </div>
                )}
                {success && (
                  <div className="mb-4 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-200 flex gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
                  </div>
                )}

                {showReview ? (
                  <div className="space-y-5">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-black text-emerald-400">Confirmação humana</span>
                      <h3 className="text-lg font-black text-text-primary mt-1">Revisar antes de gravar</h3>
                      <p className="text-xs text-text-secondary mt-1">Somente documentos canônicos ausentes serão criados. Arquivos existentes são preservados.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-4 rounded-xl border border-outline-border bg-surface-container-low"><span className="text-[10px] uppercase text-text-secondary">Arquivos a criar</span><strong className="block text-2xl text-text-primary mt-1">{plans.length}</strong></div>
                      <div className="p-4 rounded-xl border border-outline-border bg-surface-container-low"><span className="text-[10px] uppercase text-text-secondary">Respostas pendentes</span><strong className="block text-2xl text-text-primary mt-1">{pendingQuestions.length}</strong></div>
                      <div className="p-4 rounded-xl border border-outline-border bg-surface-container-low"><span className="text-[10px] uppercase text-text-secondary">Arquivos preservados</span><strong className="block text-2xl text-text-primary mt-1">{readiness.existingPaths.length}</strong></div>
                    </div>

                    <div className="space-y-2">
                      {plans.map((plan) => (
                        <div key={plan.path} className="p-3 rounded-xl border border-outline-border bg-surface-container-low flex items-center justify-between gap-3">
                          <div className="min-w-0"><strong className="text-xs text-text-primary block truncate">{plan.path}</strong><span className="text-[10px] text-text-secondary">{plan.sectionId === "pendencias" ? "Gerado a partir das lacunas declaradas" : "Documento estruturado do onboarding"}</span></div>
                          <span className={`px-2 py-1 rounded-lg border text-[9px] font-black shrink-0 ${statusClass(plan.epistemicStatus)}`}>{plan.epistemicStatus}</span>
                        </div>
                      ))}
                    </div>

                    {pendingQuestions.length > 0 && (
                      <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-100">
                        Há {pendingQuestions.length} resposta(s) ausente(s) ou marcadas como PENDENTE. Isso não bloqueia a gravação: as lacunas serão registradas explicitamente em `00_Base/Pendencias.md`.
                      </div>
                    )}

                    <div className="flex flex-wrap justify-between gap-2 pt-3 border-t border-outline-border">
                      <button type="button" onClick={resetDraft} disabled={isCommitting} className="px-3 py-2 rounded-xl border border-outline-border text-xs font-bold text-text-secondary disabled:opacity-40">Recomeçar respostas</button>
                      <button type="button" onClick={commitPlans} disabled={isCommitting || plans.length === 0} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-black flex items-center gap-2">
                        {isCommitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        {isCommitting ? "Gravando com segurança..." : "Confirmar e gravar documentos ausentes"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase tracking-wider font-black text-pink-400">Etapa {currentSectionIndex + 1} de {BASE_ONBOARDING_SECTIONS.length}</span>
                        {readiness.existingPaths.includes(`${BASE_FOLDER}/${currentSection.fileTitle}.md`) && (
                          <span className="px-2 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-[9px] font-bold text-emerald-300">Arquivo já existe — será preservado</span>
                        )}
                      </div>
                      <h3 className="text-lg font-black text-text-primary mt-1">{currentSection.title}</h3>
                      <p className="text-xs text-text-secondary mt-1 max-w-2xl">{currentSection.description}</p>
                    </div>

                    <div className="space-y-4">
                      {currentSection.questions.map((question) => {
                        const answer = draft.answers[question.id] || { value: "", status: "PENDENTE" as BaseEpistemicStatus };
                        return (
                          <div key={question.id} className="p-4 rounded-xl border border-outline-border bg-surface-container-low space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                              <div><label className="text-xs font-black text-text-primary">{question.label}</label><p className="text-[10px] text-text-secondary mt-1">{question.prompt}</p></div>
                              <select
                                value={answer.status}
                                onChange={(event) => updateAnswer(question.id, { status: event.target.value as BaseEpistemicStatus })}
                                className={`rounded-lg border px-2 py-1.5 text-[10px] font-black outline-none ${statusClass(answer.status)}`}
                              >
                                {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                              </select>
                            </div>
                            <textarea
                              value={answer.value}
                              onChange={(event) => updateAnswer(question.id, { value: event.target.value })}
                              rows={3}
                              placeholder="Digite somente o que você sabe ou decidiu. Pode deixar vazio e manter PENDENTE."
                              className="w-full rounded-xl border border-outline-border bg-surface-container-lowest px-3 py-2 text-xs text-text-primary outline-none resize-y"
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-outline-border">
                      <button type="button" onClick={() => goToSection(currentSectionIndex - 1)} disabled={currentSectionIndex === 0} className="px-3 py-2 rounded-xl border border-outline-border text-xs font-bold text-text-secondary disabled:opacity-30 flex items-center gap-1"><ChevronLeft className="w-4 h-4" />Anterior</button>
                      {currentSectionIndex < BASE_ONBOARDING_SECTIONS.length - 1 ? (
                        <button type="button" onClick={() => goToSection(currentSectionIndex + 1)} className="px-3 py-2 rounded-xl bg-pink-600 text-white text-xs font-black flex items-center gap-1">Próxima<ChevronRight className="w-4 h-4" /></button>
                      ) : (
                        <button type="button" onClick={() => setShowReview(true)} className="px-3 py-2 rounded-xl bg-pink-600 text-white text-xs font-black flex items-center gap-1">Revisar<ChevronRight className="w-4 h-4" /></button>
                      )}
                    </div>
                  </div>
                )}
              </main>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
