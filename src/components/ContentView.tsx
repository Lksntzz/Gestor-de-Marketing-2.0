import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  Film,
  Lightbulb,
  Loader2,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import type { CreativeScript, IdeaItem, ObsidianNote } from "../types";
import { api } from "../services/api";
import {
  buildExplicitEditorialItem,
  buildScriptBriefFromIdea,
  resolveCreativeScriptType,
} from "../utils/contentWorkflow";

interface ContentViewProps {
  ideas: IdeaItem[];
  scripts: CreativeScript[];
  notes: ObsidianNote[];
  onAddIdea: (idea: IdeaItem) => void;
  onAddScript: (script: CreativeScript) => void;
  onSaveToVault: (content: string, folder: string, title: string) => Promise<void>;
  engineMode: string;
}

interface GeneratedIdea {
  title: string;
  format: string;
  channel: string;
  objective: string;
  hook: string;
  concept: string;
  keyMessage: string;
  cta: string;
  suggestedVisual: string;
  rationale: string;
}

interface GeneratedScene {
  order: number | string;
  duration?: string;
  visual?: string;
  narration?: string;
  onScreenText?: string;
}

interface GeneratedScript {
  title: string;
  objective: string;
  duration: string;
  hook: string;
  scenes: GeneratedScene[];
  cta: string;
  captionSuggestion: string;
  productionNotes: string;
}

interface PlanningTarget {
  title: string;
  contentType: string;
  platform: string;
  objective: string;
  scriptId: string;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function optionalMarkdown(label: string, value: string): string {
  return value.trim() ? `**${label}:** ${value.trim()}` : "";
}

export const ContentView: React.FC<ContentViewProps> = ({
  ideas,
  scripts: _scripts,
  notes,
  onAddIdea,
  onAddScript,
  onSaveToVault,
  engineMode,
}) => {
  const [stage, setStage] = useState<"ideas" | "develop">("ideas");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [ideaObjective, setIdeaObjective] = useState("");
  const [ideaFormat, setIdeaFormat] = useState("");
  const [ideaChannel, setIdeaChannel] = useState("");

  const [scriptIdea, setScriptIdea] = useState("");
  const [scriptFormat, setScriptFormat] = useState("");
  const [scriptPlatform, setScriptPlatform] = useState("");
  const [scriptObjective, setScriptObjective] = useState("");
  const [sourceIdeaId, setSourceIdeaId] = useState<string | undefined>();
  const [sourceIdeaTitle, setSourceIdeaTitle] = useState("");

  const [generatedIdeas, setGeneratedIdeas] = useState<GeneratedIdea[]>([]);
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
  const [savedIdeaIds, setSavedIdeaIds] = useState<Record<number, string>>({});
  const [savedScriptId, setSavedScriptId] = useState<string | null>(null);

  const [sources, setSources] = useState<any[]>([]);
  const [contextWarning, setContextWarning] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "warning"; text: string } | null>(null);

  const [planningTarget, setPlanningTarget] = useState<PlanningTarget | null>(null);
  const [planningDate, setPlanningDate] = useState("");
  const [planningTime, setPlanningTime] = useState("");
  const [planningError, setPlanningError] = useState("");
  const [isPlanning, setIsPlanning] = useState(false);

  const savedIdeaOptions = useMemo(
    () => ideas.filter((idea) => idea.status !== "arquivado"),
    [ideas],
  );

  const resetGenerationFeedback = () => {
    setSources([]);
    setContextWarning("");
    setNotice(null);
  };

  const applyResponseContext = (res: any) => {
    if (Array.isArray(res?.sources)) setSources(res.sources);
    if (res?.wasFallback) {
      setContextWarning(
        "Modo offline/fallback ativado. O resultado foi produzido sem consultar a inteligência remota; revise antes de salvar.",
      );
    } else if (res?.contextWarning) {
      setContextWarning(String(res.contextWarning));
    }
  };

  const normalizeGeneratedIdea = (raw: any): GeneratedIdea => ({
    title: clean(raw?.title),
    format: clean(raw?.format) || ideaFormat.trim(),
    channel: clean(raw?.channel) || ideaChannel.trim(),
    objective: clean(raw?.objective) || ideaObjective.trim(),
    hook: clean(raw?.hook),
    concept: clean(raw?.concept),
    keyMessage: clean(raw?.keyMessage),
    cta: clean(raw?.cta),
    suggestedVisual: clean(raw?.suggestedVisual),
    rationale: clean(raw?.rationale),
  });

  const handleGenerateIdeas = async () => {
    if (!ideaObjective.trim() || !ideaFormat.trim() || !ideaChannel.trim()) return;

    setIsGenerating(true);
    resetGenerationFeedback();
    setSavedIdeaIds({});

    try {
      const res = await api.generateIdeas({
        objective: ideaObjective.trim(),
        format: ideaFormat.trim(),
        channel: ideaChannel.trim(),
        count: 3,
        engineMode,
        knowledgeNotes: notes,
      });

      const rawIdeas = Array.isArray(res?.data?.ideas) ? res.data.ideas : [];
      setGeneratedIdeas(rawIdeas.map(normalizeGeneratedIdea).filter((idea) => idea.title));
      applyResponseContext(res);
    } catch (error) {
      console.error(error);
      setNotice({ type: "warning", text: "Não foi possível gerar ideias com o contexto atual." });
    } finally {
      setIsGenerating(false);
    }
  };

  const invalidateGeneratedScript = () => {
    setGeneratedScript(null);
    setSavedScriptId(null);
    setNotice(null);
  };

  const beginDevelopment = (idea: {
    id?: string;
    title: string;
    hook?: string;
    format?: string;
    channel?: string;
    objective?: string;
    concept?: string;
    keyMessage?: string;
    callToAction?: string;
  }) => {
    const title = clean(idea.title);
    const brief = buildScriptBriefFromIdea({
      id: idea.id || "generated",
      title,
      hook: clean(idea.hook),
      format: clean(idea.format) || undefined,
      channel: clean(idea.channel) || undefined,
      objective: clean(idea.objective) || undefined,
      concept: clean(idea.concept) || undefined,
      keyMessage: clean(idea.keyMessage) || undefined,
      callToAction: clean(idea.callToAction) || undefined,
    });

    setScriptIdea(brief);
    setScriptFormat(clean(idea.format));
    setScriptPlatform(clean(idea.channel));
    setScriptObjective(clean(idea.objective));
    setSourceIdeaId(idea.id);
    setSourceIdeaTitle(title);
    invalidateGeneratedScript();
    resetGenerationFeedback();
    setStage("develop");
  };

  const handleSavedIdeaSelection = (ideaId: string) => {
    if (!ideaId) {
      setSourceIdeaId(undefined);
      setSourceIdeaTitle("");
      return;
    }

    const idea = ideas.find((item) => item.id === ideaId);
    if (!idea) return;

    beginDevelopment({
      id: idea.id,
      title: idea.title,
      hook: idea.hook,
      format: idea.format,
      channel: idea.channel,
      objective: idea.objective,
      concept: idea.concept,
      keyMessage: idea.keyMessage,
      callToAction: idea.callToAction,
    });
  };

  const handleGenerateScript = async () => {
    if (
      !scriptIdea.trim() ||
      !scriptFormat.trim() ||
      !scriptPlatform.trim() ||
      !scriptObjective.trim()
    ) {
      return;
    }

    setIsGenerating(true);
    resetGenerationFeedback();
    setSavedScriptId(null);

    try {
      const res = await api.generateScript({
        idea: scriptIdea.trim(),
        format: scriptFormat.trim(),
        platform: scriptPlatform.trim(),
        objective: scriptObjective.trim(),
        engineMode,
        knowledgeNotes: notes,
      });

      if (res?.data) {
        const data = res.data as any;
        setGeneratedScript({
          title: clean(data.title) || sourceIdeaTitle || "Roteiro",
          objective: clean(data.objective) || scriptObjective.trim(),
          duration: clean(data.duration),
          hook: clean(data.hook),
          scenes: Array.isArray(data.scenes) ? data.scenes : [],
          cta: clean(data.cta),
          captionSuggestion: clean(data.captionSuggestion),
          productionNotes: clean(data.productionNotes),
        });
      }
      applyResponseContext(res);
    } catch (error) {
      console.error(error);
      setNotice({ type: "warning", text: "Não foi possível gerar o roteiro com o contexto atual." });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveIdea = async (idea: GeneratedIdea, index: number) => {
    if (isSaving || savedIdeaIds[index]) return;
    setIsSaving(true);
    setNotice(null);

    try {
      const markdown = [
        `# ${idea.title}`,
        optionalMarkdown("Formato", idea.format),
        optionalMarkdown("Canal", idea.channel),
        optionalMarkdown("Objetivo", idea.objective),
        idea.hook ? `## Gancho\n${idea.hook}` : "",
        idea.concept ? `## Conceito\n${idea.concept}` : "",
        idea.keyMessage ? `## Mensagem Principal\n${idea.keyMessage}` : "",
        idea.cta ? `## CTA\n${idea.cta}` : "",
        idea.suggestedVisual ? `## Visual Sugerido\n${idea.suggestedVisual}` : "",
        idea.rationale ? `## Rationale\n${idea.rationale}` : "",
      ].filter(Boolean).join("\n\n");

      await onSaveToVault(markdown, "03_Conteudos/Ideias", idea.title);

      const ideaId = `idea-${Date.now()}-${index}`;
      const newIdea: IdeaItem = {
        id: ideaId,
        title: idea.title,
        status: "ideia",
        targetPersona: "",
        hook: idea.hook,
        tags: [],
        format: idea.format || undefined,
        channel: idea.channel || undefined,
        objective: idea.objective || undefined,
        concept: idea.concept || undefined,
        keyMessage: idea.keyMessage || undefined,
        callToAction: idea.cta || undefined,
        suggestedVisual: idea.suggestedVisual || undefined,
        rationale: idea.rationale || undefined,
      };

      onAddIdea(newIdea);
      setSavedIdeaIds((current) => ({ ...current, [index]: ideaId }));
      setNotice({ type: "success", text: `Ideia “${idea.title}” salva com o contexto criativo preservado.` });
    } catch (error: any) {
      setNotice({ type: "warning", text: error?.message || "Não foi possível salvar a ideia." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveScript = async (script: GeneratedScript) => {
    if (isSaving || savedScriptId) return;
    setIsSaving(true);
    setNotice(null);

    try {
      const sceneMarkdown = script.scenes.map((scene) => [
        `### Cena ${scene.order}${scene.duration ? ` (${scene.duration})` : ""}`,
        scene.visual ? `**Visual:** ${scene.visual}` : "",
        scene.narration ? `**Áudio/Narração:** ${scene.narration}` : "",
        scene.onScreenText ? `**Texto na Tela:** ${scene.onScreenText}` : "",
      ].filter(Boolean).join("\n")).join("\n\n");

      const markdown = [
        `# ${script.title}`,
        optionalMarkdown("Objetivo", script.objective),
        optionalMarkdown("Formato", scriptFormat),
        optionalMarkdown("Plataforma", scriptPlatform),
        optionalMarkdown("Duração", script.duration),
        script.hook ? `## Gancho\n${script.hook}` : "",
        sceneMarkdown ? `## Cenas\n${sceneMarkdown}` : "",
        script.cta ? `## CTA\n${script.cta}` : "",
        script.captionSuggestion ? `## Sugestão de Legenda\n${script.captionSuggestion}` : "",
        script.productionNotes ? `## Notas de Produção\n${script.productionNotes}` : "",
        sourceIdeaTitle ? `## Origem\nIdeia: ${sourceIdeaTitle}` : "",
      ].filter(Boolean).join("\n\n");

      await onSaveToVault(markdown, "03_Conteudos/Roteiros", script.title);

      const scriptId = `script-${Date.now()}`;
      const newScript: CreativeScript = {
        id: scriptId,
        title: script.title,
        type: resolveCreativeScriptType(scriptFormat, scriptPlatform),
        durationOrSlides: script.duration,
        objective: script.objective || scriptObjective.trim(),
        targetAudience: "",
        hookScene: script.hook,
        bodyScenes: script.scenes.map((scene) => ({
          step: `Cena ${scene.order}`,
          visualCues: clean(scene.visual),
          audioOrNarration: clean(scene.narration),
        })),
        callToAction: script.cta,
        tags: [],
        platform: scriptPlatform.trim(),
        format: scriptFormat.trim(),
        sourceIdeaId,
        sourceIdeaTitle: sourceIdeaTitle || undefined,
      };

      onAddScript(newScript);
      setSavedScriptId(scriptId);
      setNotice({ type: "success", text: `Roteiro “${script.title}” salvo. Agora ele pode ser planejado.` });
    } catch (error: any) {
      setNotice({ type: "warning", text: error?.message || "Não foi possível salvar o roteiro." });
    } finally {
      setIsSaving(false);
    }
  };

  const openPlanning = () => {
    if (!generatedScript || !savedScriptId) return;

    setPlanningTarget({
      title: generatedScript.title,
      contentType: scriptFormat,
      platform: scriptPlatform,
      objective: generatedScript.objective || scriptObjective,
      scriptId: savedScriptId,
    });
    setPlanningDate("");
    setPlanningTime("");
    setPlanningError("");
  };

  const handleConfirmPlanning = async () => {
    if (!planningTarget || isPlanning) return;
    setPlanningError("");
    setIsPlanning(true);

    try {
      const item = buildExplicitEditorialItem({
        id: `ed-${Date.now()}`,
        title: planningTarget.title,
        contentType: planningTarget.contentType,
        platform: planningTarget.platform,
        objective: planningTarget.objective,
        scheduledDate: planningDate,
        scheduledTime: planningTime,
        status: "IN_PRODUCTION",
        scriptId: planningTarget.scriptId,
      });

      if (!window.electronAPI?.editorialUpsert) {
        throw new Error("O planejamento editorial exige o runtime desktop.");
      }

      const result = await window.electronAPI.editorialUpsert(item);
      if (!result?.success) throw new Error("O calendário não confirmou a gravação.");

      setPlanningTarget(null);
      setPlanningDate("");
      setPlanningTime("");
      setNotice({
        type: "success",
        text: `Publicação planejada para ${item.scheduledDate}${item.scheduledTime ? ` às ${item.scheduledTime}` : ""} em ${item.platform}.`,
      });
    } catch (error: any) {
      setPlanningError(error?.message || "Não foi possível planejar o conteúdo.");
    } finally {
      setIsPlanning(false);
    }
  };

  const changeScriptField = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    setter(value);
    invalidateGeneratedScript();
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col text-text-primary">
      <header className="shrink-0 border-b border-outline-border px-2 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Criar</h1>
          <p className="mt-1 text-xs text-text-secondary">
            Um fluxo contínuo: definir o briefing, escolher uma ideia, desenvolver o conteúdo e só então planejar.
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStage("ideas")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border ${
              stage === "ideas"
                ? "border-pink-500/40 bg-pink-500/10 text-pink-300"
                : "border-outline-border text-text-secondary"
            }`}
          >
            <Lightbulb className="w-4 h-4" />
            1. Ideias
          </button>
          <ArrowRight className="w-4 h-4 text-text-secondary/50" />
          <button
            type="button"
            onClick={() => setStage("develop")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border ${
              stage === "develop"
                ? "border-pink-500/40 bg-pink-500/10 text-pink-300"
                : "border-outline-border text-text-secondary"
            }`}
          >
            <Film className="w-4 h-4" />
            2. Desenvolver
          </button>
        </div>
      </header>

      {notice && (
        <div className={`mt-4 mx-2 rounded-xl border p-3 text-xs ${
          notice.type === "success"
            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
            : "border-amber-500/25 bg-amber-500/10 text-amber-300"
        }`}>
          {notice.text}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-2 pt-4">
        {stage === "ideas" ? (
          <div className="grid grid-cols-1 xl:grid-cols-[330px_minmax(0,1fr)] gap-5">
            <aside className="bg-surface-card border border-outline-border p-5 rounded-2xl self-start">
              <h2 className="font-bold text-base">Briefing da ideia</h2>
              <p className="text-[11px] text-text-secondary mt-1">
                Objetivo, formato e canal são decisões explícitas; o Nisti não escolhe silenciosamente por você.
              </p>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="block text-[10px] uppercase text-text-secondary font-bold mb-1">Objetivo</span>
                  <input
                    value={ideaObjective}
                    onChange={(event) => setIdeaObjective(event.target.value)}
                    className="w-full bg-background border border-outline-border rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500/60"
                    placeholder="Ex: apresentar uma nova linha de produto"
                  />
                </label>

                <label className="block">
                  <span className="block text-[10px] uppercase text-text-secondary font-bold mb-1">Formato</span>
                  <input
                    value={ideaFormat}
                    onChange={(event) => setIdeaFormat(event.target.value)}
                    className="w-full bg-background border border-outline-border rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500/60"
                    placeholder="Ex: Reel, carrossel, artigo"
                  />
                </label>

                <label className="block">
                  <span className="block text-[10px] uppercase text-text-secondary font-bold mb-1">Canal</span>
                  <input
                    value={ideaChannel}
                    onChange={(event) => setIdeaChannel(event.target.value)}
                    className="w-full bg-background border border-outline-border rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500/60"
                    placeholder="Ex: Instagram, TikTok, LinkedIn"
                  />
                </label>
              </div>

              <button
                disabled={
                  isGenerating ||
                  !ideaObjective.trim() ||
                  !ideaFormat.trim() ||
                  !ideaChannel.trim()
                }
                onClick={handleGenerateIdeas}
                className="w-full mt-5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center disabled:opacity-40"
              >
                {isGenerating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Gerar ideias
                  </>
                )}
              </button>

              {sources.length > 0 && (
                <div className="mt-5 border-t border-outline-border pt-4">
                  <h3 className="text-xs text-text-secondary font-bold mb-2">
                    Fontes usadas ({sources.length})
                  </h3>
                  <ul className="text-[11px] text-text-secondary space-y-1">
                    {sources.map((source, index) => (
                      <li key={`${source?.path || source?.title || "source"}-${index}`} className="truncate">
                        • {source?.title || source?.path || "Fonte"}
                        {source?.epistemicStatus ? ` (${source.epistemicStatus})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {contextWarning && (
                <div className="mt-3 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <p>{contextWarning}</p>
                </div>
              )}
            </aside>

            <section className="bg-surface-card border border-outline-border p-5 rounded-2xl min-h-[420px]">
              <div className="flex items-end justify-between gap-3 border-b border-outline-border pb-3">
                <div>
                  <h2 className="font-bold">Ideias propostas</h2>
                  <p className="text-[11px] text-text-secondary mt-1">
                    Escolha uma ideia para desenvolver. Salvar preserva o contexto para retomada futura.
                  </p>
                </div>
                {generatedIdeas.length > 0 && (
                  <span className="text-[10px] text-text-secondary">{generatedIdeas.length} proposta(s)</span>
                )}
              </div>

              {generatedIdeas.length === 0 && !isGenerating ? (
                <div className="min-h-72 flex flex-col items-center justify-center text-center text-text-secondary">
                  <Lightbulb className="w-8 h-8 opacity-40" />
                  <p className="mt-3 text-sm font-bold text-text-primary">Nenhuma ideia gerada ainda</p>
                  <p className="mt-1 text-xs max-w-md">Preencha o briefing ao lado para gerar propostas fundamentadas na Base disponível.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {generatedIdeas.map((idea, index) => (
                    <article key={`${idea.title}-${index}`} className="border border-outline-border bg-background/35 p-5 rounded-xl">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="font-bold text-lg">{idea.title}</h3>
                          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-text-secondary">
                            {idea.format && <span className="px-2 py-1 rounded-full border border-outline-border">{idea.format}</span>}
                            {idea.channel && <span className="px-2 py-1 rounded-full border border-outline-border">{idea.channel}</span>}
                            {idea.objective && <span className="px-2 py-1 rounded-full border border-outline-border">{idea.objective}</span>}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => beginDevelopment({
                              id: savedIdeaIds[index],
                              title: idea.title,
                              hook: idea.hook,
                              format: idea.format,
                              channel: idea.channel,
                              objective: idea.objective,
                              concept: idea.concept,
                              keyMessage: idea.keyMessage,
                              callToAction: idea.cta,
                            })}
                            className="px-3 py-2 rounded-lg bg-pink-500/15 border border-pink-500/25 text-pink-300 text-xs font-bold flex items-center gap-1.5"
                          >
                            Desenvolver
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>

                          <button
                            disabled={isSaving || Boolean(savedIdeaIds[index])}
                            onClick={() => void handleSaveIdea(idea, index)}
                            className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {savedIdeaIds[index] ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                            {savedIdeaIds[index] ? "Salva" : "Salvar"}
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        {idea.hook && <div><span className="text-text-secondary block mb-1">Gancho</span><span>{idea.hook}</span></div>}
                        {idea.keyMessage && <div><span className="text-text-secondary block mb-1">Mensagem principal</span><span>{idea.keyMessage}</span></div>}
                        {idea.concept && <div className="md:col-span-2"><span className="text-text-secondary block mb-1">Conceito</span><span>{idea.concept}</span></div>}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[350px_minmax(0,1fr)] gap-5">
            <aside className="bg-surface-card border border-outline-border p-5 rounded-2xl self-start">
              <h2 className="font-bold text-base">Desenvolver conteúdo</h2>
              <p className="text-[11px] text-text-secondary mt-1">
                Continue uma ideia gerada nesta sessão ou retome uma ideia já salva.
              </p>

              <label className="block mt-5">
                <span className="block text-[10px] uppercase text-text-secondary font-bold mb-1">Ideias salvas</span>
                <select
                  value={sourceIdeaId || ""}
                  onChange={(event) => handleSavedIdeaSelection(event.target.value)}
                  className="w-full bg-background border border-outline-border rounded-lg px-3 py-2 text-sm outline-none"
                >
                  <option value="">Nenhuma ideia salva selecionada</option>
                  {savedIdeaOptions.map((idea) => (
                    <option key={idea.id} value={idea.id}>{idea.title}</option>
                  ))}
                </select>
              </label>

              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="block text-[10px] uppercase text-text-secondary font-bold mb-1">Ideia / briefing</span>
                  <textarea
                    value={scriptIdea}
                    onChange={(event) => changeScriptField(setScriptIdea, event.target.value)}
                    className="w-full h-36 bg-background border border-outline-border rounded-lg px-3 py-2 text-sm outline-none resize-none focus:border-pink-500/60"
                    placeholder="Escolha uma ideia ou descreva o conteúdo que deseja desenvolver."
                  />
                </label>

                <label className="block">
                  <span className="block text-[10px] uppercase text-text-secondary font-bold mb-1">Objetivo</span>
                  <input
                    value={scriptObjective}
                    onChange={(event) => changeScriptField(setScriptObjective, event.target.value)}
                    className="w-full bg-background border border-outline-border rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500/60"
                    placeholder="Defina o objetivo deste conteúdo"
                  />
                </label>

                <label className="block">
                  <span className="block text-[10px] uppercase text-text-secondary font-bold mb-1">Formato</span>
                  <input
                    value={scriptFormat}
                    onChange={(event) => changeScriptField(setScriptFormat, event.target.value)}
                    className="w-full bg-background border border-outline-border rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500/60"
                    placeholder="Ex: Reel, carrossel, YouTube"
                  />
                </label>

                <label className="block">
                  <span className="block text-[10px] uppercase text-text-secondary font-bold mb-1">Plataforma</span>
                  <input
                    value={scriptPlatform}
                    onChange={(event) => changeScriptField(setScriptPlatform, event.target.value)}
                    className="w-full bg-background border border-outline-border rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500/60"
                    placeholder="Ex: Instagram, TikTok, YouTube"
                  />
                </label>
              </div>

              <button
                disabled={
                  isGenerating ||
                  !scriptIdea.trim() ||
                  !scriptObjective.trim() ||
                  !scriptFormat.trim() ||
                  !scriptPlatform.trim()
                }
                onClick={handleGenerateScript}
                className="w-full mt-5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center disabled:opacity-40"
              >
                {isGenerating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Gerar conteúdo
                  </>
                )}
              </button>

              {sourceIdeaTitle && (
                <div className="mt-3 rounded-lg border border-outline-border bg-background/40 p-3 text-[11px] text-text-secondary">
                  Origem: <strong className="text-text-primary">{sourceIdeaTitle}</strong>
                </div>
              )}

              {sources.length > 0 && (
                <div className="mt-5 border-t border-outline-border pt-4">
                  <h3 className="text-xs text-text-secondary font-bold mb-2">Fontes usadas ({sources.length})</h3>
                  <ul className="text-[11px] text-text-secondary space-y-1">
                    {sources.map((source, index) => (
                      <li key={`${source?.path || source?.title || "source"}-${index}`} className="truncate">
                        • {source?.title || source?.path || "Fonte"}
                        {source?.epistemicStatus ? ` (${source.epistemicStatus})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {contextWarning && (
                <div className="mt-3 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <p>{contextWarning}</p>
                </div>
              )}
            </aside>

            <section className="bg-surface-card border border-outline-border p-5 rounded-2xl min-h-[420px]">
              <div className="flex items-end justify-between gap-3 border-b border-outline-border pb-3">
                <div>
                  <h2 className="font-bold">Conteúdo desenvolvido</h2>
                  <p className="text-[11px] text-text-secondary mt-1">
                    Salve primeiro. Planejamento só acontece depois, com data escolhida explicitamente.
                  </p>
                </div>
              </div>

              {!generatedScript && !isGenerating ? (
                <div className="min-h-72 flex flex-col items-center justify-center text-center text-text-secondary">
                  <Film className="w-8 h-8 opacity-40" />
                  <p className="mt-3 text-sm font-bold text-text-primary">Nenhum conteúdo desenvolvido ainda</p>
                  <p className="mt-1 text-xs max-w-md">Escolha uma ideia ou preencha o briefing para gerar o conteúdo.</p>
                </div>
              ) : generatedScript ? (
                <article className="mt-4 border border-outline-border bg-background/35 p-5 rounded-xl">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-xl">{generatedScript.title}</h3>
                      <p className="text-xs text-text-secondary mt-1">
                        {[generatedScript.duration, generatedScript.objective, scriptPlatform].filter(Boolean).join(" • ")}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        disabled={isSaving || Boolean(savedScriptId)}
                        onClick={() => void handleSaveScript(generatedScript)}
                        className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {savedScriptId ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                        {savedScriptId ? "Salvo" : "Salvar"}
                      </button>

                      <button
                        disabled={!savedScriptId}
                        onClick={openPlanning}
                        title={!savedScriptId ? "Salve o conteúdo antes de planejar" : "Escolha a data de publicação"}
                        className="px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        Planejar
                      </button>
                    </div>
                  </div>

                  {generatedScript.hook && (
                    <div className="mt-5">
                      <h4 className="text-[10px] text-text-secondary font-bold uppercase mb-2">Gancho</h4>
                      <p className="text-sm bg-background/60 p-3 rounded-lg border border-outline-border">{generatedScript.hook}</p>
                    </div>
                  )}

                  {generatedScript.scenes.length > 0 && (
                    <div className="mt-5 space-y-3">
                      <h4 className="text-[10px] text-text-secondary font-bold uppercase">Cenas / etapas</h4>
                      {generatedScript.scenes.map((scene, index) => (
                        <div key={`${scene.order}-${index}`} className="bg-background/50 p-4 rounded-lg border border-outline-border flex gap-4">
                          <div className="shrink-0 w-8 h-8 rounded-full bg-pink-500/10 text-pink-300 flex items-center justify-center font-bold text-xs">{scene.order}</div>
                          <div className="text-sm space-y-2 flex-1 min-w-0">
                            {scene.visual && <div><span className="text-text-secondary mr-2 text-xs">Visual:</span><span>{scene.visual}</span></div>}
                            {scene.narration && <div><span className="text-text-secondary mr-2 text-xs">Narração:</span><span>{scene.narration}</span></div>}
                            {scene.onScreenText && <div><span className="text-text-secondary mr-2 text-xs">Tela:</span><span>{scene.onScreenText}</span></div>}
                          </div>
                          {scene.duration && <div className="shrink-0 text-[10px] text-text-secondary mt-1">{scene.duration}</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {generatedScript.cta && (
                    <div className="mt-5">
                      <h4 className="text-[10px] text-text-secondary font-bold uppercase mb-2">CTA</h4>
                      <p className="text-sm bg-background/60 p-3 rounded-lg border border-outline-border">{generatedScript.cta}</p>
                    </div>
                  )}
                </article>
              ) : null}
            </section>
          </div>
        )}
      </div>

      {planningTarget && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-outline-border bg-surface-card shadow-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-300">Planejamento explícito</span>
                <h2 className="mt-1 text-lg font-black">Escolha a data de publicação</h2>
                <p className="mt-1 text-xs text-text-secondary">{planningTarget.title} • {planningTarget.platform}</p>
              </div>
              <button
                type="button"
                onClick={() => setPlanningTarget(null)}
                className="p-1.5 rounded-lg border border-outline-border text-text-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label>
                <span className="block text-[10px] uppercase text-text-secondary font-bold mb-1">Data *</span>
                <input
                  type="date"
                  value={planningDate}
                  onChange={(event) => setPlanningDate(event.target.value)}
                  className="w-full bg-background border border-outline-border rounded-lg px-3 py-2 text-sm outline-none"
                />
              </label>
              <label>
                <span className="block text-[10px] uppercase text-text-secondary font-bold mb-1">Horário opcional</span>
                <input
                  type="time"
                  value={planningTime}
                  onChange={(event) => setPlanningTime(event.target.value)}
                  className="w-full bg-background border border-outline-border rounded-lg px-3 py-2 text-sm outline-none"
                />
              </label>
            </div>

            {planningError && (
              <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-300">
                {planningError}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPlanningTarget(null)}
                className="px-4 py-2 rounded-lg border border-outline-border text-xs font-bold text-text-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPlanning || !planningDate}
                onClick={() => void handleConfirmPlanning()}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-40 flex items-center gap-1.5"
              >
                {isPlanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                Confirmar planejamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
