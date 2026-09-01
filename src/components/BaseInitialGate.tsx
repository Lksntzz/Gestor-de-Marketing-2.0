import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, ShieldCheck } from "lucide-react";
import type { ObsidianApiConfig, ObsidianNote } from "../types";
import {
  BASE_ONBOARDING_SECTIONS,
  BASE_ONBOARDING_STORAGE_KEY,
  assessBaseReadiness,
  buildBaseDocumentPlans,
  countUnreviewedBaseAnswers,
  createEmptyBaseOnboardingDraft,
  type BaseEpistemicStatus,
  type BaseOnboardingDraft,
} from "../domain/baseOnboarding";
import { api } from "../services/api";
import {
  OBSIDIAN_CONNECTED_EVENT,
  OBSIDIAN_DISCONNECTED_EVENT,
  OBSIDIAN_SNAPSHOT_EVENT,
} from "../services/obsidianRuntimeState";
import { stripNistiKnowledgeRoot } from "../services/obsidianKnowledgeAutomation";
import { replacePersistentAppState } from "../services/persistentStateBridge";
import { APP_STATE_KEYS, StorageManager } from "../services/storage/StorageManager";

const storage = StorageManager.getInstance();

const DEFAULT_API_CONFIG: ObsidianApiConfig = {
  endpoint: "https://127.0.0.1:27124",
  apiKey: "",
  geminiApiKey: "",
  openaiApiKey: "",
  aiProvider: "gemini",
  aiModel: "",
  vaultName: "",
  useHttps: true,
  autoSync: true,
  syncIntervalSeconds: 60,
  connectionStatus: "disconnected",
  allowSelfSignedCerts: true,
};

function normalizeBaseNotes(notes: ObsidianNote[]): ObsidianNote[] {
  return notes.map((note) => {
    const path = stripNistiKnowledgeRoot(note.path);
    const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : note.folder;
    return { ...note, path, folder };
  });
}

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
    skippedSectionIds: [],
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : fallback.updatedAt,
  };
}

function statusButtonClass(active: boolean, status: BaseEpistemicStatus): string {
  if (!active) return "border-outline-border text-text-secondary bg-surface-container-low";
  if (status === "CONFIRMADO") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (status === "HIPÓTESE") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return "border-slate-500/40 bg-slate-500/10 text-slate-300";
}

export function BaseInitialGate({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<ObsidianNote[]>(() =>
    storage.loadAppState<ObsidianNote[]>(APP_STATE_KEYS.NOTES, []),
  );
  const [connected, setConnected] = useState(() => api.isObsidianSessionVerified());
  const [draft, setDraft] = useState<BaseOnboardingDraft>(() => loadDraft());
  const [step, setStep] = useState(() =>
    Math.max(0, BASE_ONBOARDING_SECTIONS.findIndex((section) => section.id === loadDraft().currentSectionId)),
  );
  const [review, setReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const normalizedNotes = useMemo(() => normalizeBaseNotes(notes), [notes]);
  const readiness = useMemo(() => assessBaseReadiness(normalizedNotes), [normalizedNotes]);
  const plans = useMemo(() => buildBaseDocumentPlans(draft, normalizedNotes), [draft, normalizedNotes]);
  const blockers = useMemo(() => countUnreviewedBaseAnswers(draft), [draft]);

  const persistDraft = (next: BaseOnboardingDraft) => {
    const persisted = { ...next, updatedAt: new Date().toISOString() };
    setDraft(persisted);
    storage.saveAppState(BASE_ONBOARDING_STORAGE_KEY, persisted);
  };

  const refreshFromRest = async () => {
    if (!api.isObsidianSessionVerified()) return;
    try {
      const config = await storage.loadApiConfig(DEFAULT_API_CONFIG);
      const synchronized = await api.syncWebObsidianNotes(config);
      setNotes(synchronized);
      replacePersistentAppState(APP_STATE_KEYS.NOTES, synchronized);
    } catch (error) {
      console.warn("Não foi possível atualizar a Base Inicial pelo REST.", error);
    }
  };

  useEffect(() => {
    const onConnected = () => {
      setConnected(true);
      void refreshFromRest();
    };
    const onDisconnected = () => setConnected(false);
    const onSnapshot = () => void refreshFromRest();
    window.addEventListener(OBSIDIAN_CONNECTED_EVENT, onConnected);
    window.addEventListener(OBSIDIAN_DISCONNECTED_EVENT, onDisconnected);
    window.addEventListener(OBSIDIAN_SNAPSHOT_EVENT, onSnapshot);
    if (api.isObsidianSessionVerified()) void refreshFromRest();
    return () => {
      window.removeEventListener(OBSIDIAN_CONNECTED_EVENT, onConnected);
      window.removeEventListener(OBSIDIAN_DISCONNECTED_EVENT, onDisconnected);
      window.removeEventListener(OBSIDIAN_SNAPSHOT_EVENT, onSnapshot);
    };
  }, []);

  if (readiness.structurallyComplete) return <>{children}</>;

  const currentSection = BASE_ONBOARDING_SECTIONS[step];

  const updateAnswer = (questionId: string, patch: { value?: string; status?: BaseEpistemicStatus }) => {
    const previous = draft.answers[questionId] || { value: "", status: "PENDENTE" as BaseEpistemicStatus };
    persistDraft({
      ...draft,
      currentSectionId: currentSection.id,
      answers: {
        ...draft.answers,
        [questionId]: {
          value: patch.value !== undefined ? patch.value : previous.value,
          status: patch.status || previous.status,
        },
      },
    });
    setMessage(null);
  };

  const goTo = (nextStep: number) => {
    const bounded = Math.max(0, Math.min(nextStep, BASE_ONBOARDING_SECTIONS.length - 1));
    setStep(bounded);
    persistDraft({ ...draft, currentSectionId: BASE_ONBOARDING_SECTIONS[bounded].id });
    setReview(false);
    setMessage(null);
  };

  const commitBase = async () => {
    if (!connected || !api.isObsidianSessionVerified()) {
      setMessage({ type: "error", text: "Conecte o Obsidian Local REST API antes de gravar a Base Inicial." });
      return;
    }
    if (blockers > 0) {
      setMessage({
        type: "error",
        text: `Ainda existem ${blockers} resposta(s) sem revisão/classificação. Revise cada item como CONFIRMADO, HIPÓTESE ou PENDENTE antes de gravar.`,
      });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const config = await storage.loadApiConfig(DEFAULT_API_CONFIG);
      const latest = await api.syncWebObsidianNotes(config);
      const latestNormalized = normalizeBaseNotes(latest);
      const pendingPlans = buildBaseDocumentPlans(draft, latestNormalized);

      for (const plan of pendingPlans) {
        const result = await api.pushNoteToObsidian(config, plan.path, plan.content, plan.frontmatter);
        if (!result?.success) {
          throw new Error(result?.message || `O Obsidian não confirmou ${plan.path}.`);
        }
      }

      const verifiedNotes = await api.syncWebObsidianNotes(config);
      const verifiedReadiness = assessBaseReadiness(normalizeBaseNotes(verifiedNotes));
      if (!verifiedReadiness.structurallyComplete) {
        throw new Error(
          `A gravação terminou, mas a releitura ainda aponta ${verifiedReadiness.missingSectionIds.length} documento(s) canônico(s) ausente(s).`,
        );
      }

      replacePersistentAppState(APP_STATE_KEYS.NOTES, verifiedNotes);
      setNotes(verifiedNotes);
      localStorage.removeItem(BASE_ONBOARDING_STORAGE_KEY);
      setDraft(createEmptyBaseOnboardingDraft());
      setMessage({
        type: "success",
        text: "Base Inicial gravada e verificada pelo Obsidian. Hipóteses e pendências permanecem rotuladas e não são promovidas a fatos.",
      });
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Falha ao gravar e verificar a Base Inicial." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d18] text-text-primary p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-5xl rounded-3xl border border-outline-border bg-surface-card shadow-2xl overflow-hidden">
        <header className="p-5 md:p-7 border-b border-outline-border flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-black text-pink-400">
              <ShieldCheck className="w-4 h-4" /> Primeiro passo obrigatório
            </div>
            <h1 className="text-2xl font-black mt-2">Onboarding da Base Inicial</h1>
            <p className="text-xs text-text-secondary mt-1 max-w-2xl">
              O Nisti só libera geração depois que os documentos canônicos forem criados e revisados por você. CONFIRMADO, HIPÓTESE e PENDENTE continuam distintos; nenhuma informação é inventada automaticamente.
            </p>
          </div>
          <div className={`text-[11px] font-bold px-3 py-2 rounded-xl border ${connected ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>
            {connected ? "Obsidian REST conectado" : "Obsidian desconectado"}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[560px]">
          <aside className="md:col-span-3 border-b md:border-b-0 md:border-r border-outline-border p-3">
            <div className="space-y-1">
              {BASE_ONBOARDING_SECTIONS.map((section, index) => (
                <button
                  type="button"
                  key={section.id}
                  onClick={() => goTo(index)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs border ${!review && index === step ? "border-pink-500/30 bg-pink-500/10 text-text-primary" : "border-transparent text-text-secondary hover:bg-surface-container-low"}`}
                >
                  <strong className="block">{index + 1}. {section.title}</strong>
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setReview(true); setMessage(null); }}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs border ${review ? "border-emerald-500/30 bg-emerald-500/10" : "border-transparent text-text-secondary hover:bg-surface-container-low"}`}
              >
                <strong className="block">Revisar e gravar</strong>
                <span className="text-[10px] opacity-70">{blockers} revisão(ões) pendente(s)</span>
              </button>
            </div>
          </aside>

          <main className="md:col-span-9 p-5 md:p-7 overflow-y-auto">
            {message && (
              <div className={`mb-5 p-3 rounded-xl border text-xs flex items-start gap-2 ${message.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-red-500/30 bg-red-500/10 text-red-200"}`}>
                {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                {message.text}
              </div>
            )}

            {review ? (
              <div className="space-y-5">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-black text-emerald-400">Revisão humana</span>
                  <h2 className="text-xl font-black mt-1">Revisar antes de criar a Base</h2>
                  <p className="text-xs text-text-secondary mt-1">
                    A gravação é REST-first, bloqueia colisões e só mostra sucesso depois de reler cada arquivo no mesmo Vault autenticado.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-outline-border p-4"><span className="text-[10px] text-text-secondary uppercase">Canônicos ausentes</span><strong className="block text-2xl mt-1">{readiness.missingSectionIds.length}</strong></div>
                  <div className="rounded-xl border border-outline-border p-4"><span className="text-[10px] text-text-secondary uppercase">Respostas a revisar</span><strong className="block text-2xl mt-1">{blockers}</strong></div>
                  <div className="rounded-xl border border-outline-border p-4"><span className="text-[10px] text-text-secondary uppercase">Arquivos a gravar</span><strong className="block text-2xl mt-1">{plans.length}</strong></div>
                </div>
                {blockers > 0 ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-100">
                    Revise cada pergunta. Você pode manter uma informação como HIPÓTESE ou PENDENTE; somente CONFIRMADO será tratado como fato. O que não pode ficar é uma pergunta sem revisão/classificação.
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-100">
                    Todas as perguntas foram revisadas. Hipóteses e pendências serão gravadas com seus próprios estados e continuarão fora da categoria de fato confirmado.
                  </div>
                )}
                <div className="flex justify-between gap-3 pt-4 border-t border-outline-border">
                  <button type="button" onClick={() => setReview(false)} className="px-4 py-2 rounded-xl border border-outline-border text-xs font-bold">Voltar</button>
                  <button
                    type="button"
                    onClick={() => void commitBase()}
                    disabled={saving || blockers > 0 || !connected}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-black flex items-center gap-2"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Gravar e verificar Base Inicial
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-black text-pink-400">Etapa {step + 1} de {BASE_ONBOARDING_SECTIONS.length}</span>
                  <h2 className="text-xl font-black mt-1">{currentSection.title}</h2>
                  <p className="text-xs text-text-secondary mt-1">{currentSection.description}</p>
                </div>

                <div className="space-y-5">
                  {currentSection.questions.map((question) => {
                    const answer = draft.answers[question.id] || { value: "", status: "PENDENTE" as BaseEpistemicStatus };
                    return (
                      <div key={question.id} className="rounded-2xl border border-outline-border p-4 bg-surface-container-low/40">
                        <label className="text-xs font-black block">{question.label}</label>
                        <p className="text-[11px] text-text-secondary mt-1">{question.prompt}</p>
                        <textarea
                          value={answer.value}
                          onChange={(event) => updateAnswer(question.id, { value: event.target.value })}
                          rows={3}
                          className="mt-3 w-full rounded-xl border border-outline-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-pink-500/50"
                          placeholder="Escreva apenas informação real conhecida por você; se não souber, deixe vazio e classifique como PENDENTE."
                        />
                        <div className="flex flex-wrap gap-2 mt-3">
                          {(["CONFIRMADO", "HIPÓTESE", "PENDENTE"] as BaseEpistemicStatus[]).map((status) => (
                            <button
                              type="button"
                              key={status}
                              onClick={() => updateAnswer(question.id, { status })}
                              className={`px-3 py-1.5 rounded-lg border text-[10px] font-black ${statusButtonClass(answer.status === status, status)}`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between gap-3 pt-4 border-t border-outline-border">
                  <button type="button" onClick={() => goTo(step - 1)} disabled={step === 0} className="px-4 py-2 rounded-xl border border-outline-border disabled:opacity-30 text-xs font-bold flex items-center gap-2"><ChevronLeft className="w-4 h-4" /> Anterior</button>
                  {step < BASE_ONBOARDING_SECTIONS.length - 1 ? (
                    <button type="button" onClick={() => goTo(step + 1)} className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black flex items-center gap-2">Próxima <ChevronRight className="w-4 h-4" /></button>
                  ) : (
                    <button type="button" onClick={() => setReview(true)} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black">Revisar Base</button>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
