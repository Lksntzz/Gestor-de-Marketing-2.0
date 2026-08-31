import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  FileText,
  Film,
  Lightbulb,
  Loader2,
  Save,
  Sparkles,
} from "lucide-react";
import type { CreativeScript, EditorialItem, IdeaItem, ObsidianNote } from "../types";
import { creationGenerationClient } from "../services/creationGenerationClient";
import { storeEditorialPlanningHandoff } from "../services/editorialPlanningHandoff";
import {
  buildCreationBriefingInstructions,
  creationBriefingBaseStatus,
  normalizeCreationBriefing,
  validateCreationBriefing,
  type CreationBriefing,
} from "../domain/creationBriefing";
import {
  buildCreativeLibrary,
  creativeLibraryCounts,
  type CreativeLibraryEntry,
  type CreativeLibraryStatus,
} from "../domain/creativeLibrary";
import {
  buildCreativeArtifactMarkdown,
  buildScriptBriefFromIdea,
  resolveCreativeScriptType,
} from "../utils/contentWorkflow";

const IDEA_GENERATION_COUNT = 5;

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

type CreationStage = "briefing" | "ideas" | "develop";

const LIBRARY_STATUS: Record<CreativeLibraryStatus, { label: string; className: string }> = {
  idea: { label: "Ideia", className: "border-slate-500/25 bg-slate-500/10 text-slate-300" },
  development: { label: "Em desenvolvimento", className: "border-amber-500/25 bg-amber-500/10 text-amber-300" },
  approved: { label: "Aprovado", className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" },
  planned: { label: "Planejado", className: "border-indigo-500/25 bg-indigo-500/10 text-indigo-300" },
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function optionalMarkdown(label: string, value: string): string {
  return value.trim() ? `**${label}:** ${value.trim()}` : "";
}

function SourceTrace({ sources, warning }: { sources: any[]; warning: string }) {
  return (
    <>
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
      {warning && (
        <div className="mt-3 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p>{warning}</p>
        </div>
      )}
    </>
  );
}

export const ContentView: React.FC<ContentViewProps> = ({
  ideas,
  scripts,
  notes,
  onAddIdea,
  onAddScript,
  onSaveToVault,
  engineMode,
}) => {
  const [stage, setStage] = useState<CreationStage>("briefing");
  const [briefing, setBriefing] = useState<CreationBriefing>(() => normalizeCreationBriefing({}));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [editorialItems, setEditorialItems] = useState<EditorialItem[]>([]);

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

  const normalizedBriefing = useMemo(() => normalizeCreationBriefing(briefing), [briefing]);
  const briefingValidation = useMemo(() => validateCreationBriefing(briefing), [briefing]);
  const baseStatus = useMemo(() => creationBriefingBaseStatus(notes), [notes]);
  const briefingReady = briefingValidation.valid && baseStatus.ready;
  const briefingInstructions = useMemo(
    () => buildCreationBriefingInstructions(normalizedBriefing),
    [normalizedBriefing],
  );

  const savedIdeaOptions = useMemo(
    () => ideas.filter((idea) => idea.status !== "arquivado"),
    [ideas],
  );
  const libraryEntries = useMemo(
    () => buildCreativeLibrary(ideas, scripts, editorialItems),
    [ideas, scripts, editorialItems],
  );
  const libraryCounts = useMemo(() => creativeLibraryCounts(libraryEntries), [libraryEntries]);

  useEffect(() => {
    if (!window.electronAPI?.editorialList) {
      setEditorialItems([]);
      return;
    }
    void window.electronAPI.editorialList()
      .then((items) => setEditorialItems(Array.isArray(items) ? items : []))
      .catch((error) => {
        console.warn("Não foi possível atualizar o estado editorial da biblioteca.", error);
        setEditorialItems([]);
      });
  }, []);

  const resetGenerationFeedback = () => {
    setSources([]);
    setContextWarning("");
    setNotice(null);
  };

  const applyResponseContext = (res: any) => {
    if (Array.isArray(res?.sources)) setSources(res.sources);
    if (res?.contextWarning) setContextWarning(String(res.contextWarning));
  };

  const invalidateGeneratedScript = () => {
    setGeneratedScript(null);
    setSavedScriptId(null);
    setNotice(null);
  };

  const updateBriefing = (field: keyof CreationBriefing, value: string) => {
    setBriefing((current) => ({ ...current, [field]: value }));
    setGeneratedIdeas([]);
    setSavedIdeaIds({});
    invalidateGeneratedScript();
    resetGenerationFeedback();
  };

  const confirmBriefing = () => {
    if (!briefingReady) return;
    setStage("ideas");
    resetGenerationFeedback();
  };

  const normalizeGeneratedIdea = (raw: any): GeneratedIdea => ({
    title: clean(raw?.title),
    format: clean(raw?.format) || normalizedBriefing.format,
    channel: clean(raw?.channel) || normalizedBriefing.channel,
    objective: clean(raw?.objective) || normalizedBriefing.objective,
    hook: clean(raw?.hook),
    concept: clean(raw?.concept),
    keyMessage: clean(raw?.keyMessage),
    cta: clean(raw?.cta),
    suggestedVisual: clean(raw?.suggestedVisual),
    rationale: clean(raw?.rationale),
  });

  const handleGenerateIdeas = async () => {
    if (!briefingReady) {
      setStage("briefing");
      return;
    }
    setIsGenerating(true);
    resetGenerationFeedback();
    setSavedIdeaIds({});
    try {
      const res = await creationGenerationClient.generateIdeas({
        objective: normalizedBriefing.objective,
        format: normalizedBriefing.format,
        channel: normalizedBriefing.channel,
        theme: normalizedBriefing.theme,
        customInstructions: briefingInstructions,
        count: IDEA_GENERATION_COUNT,
        engineMode,
        knowledgeNotes: notes,
      });
      const rawIdeas = Array.isArray(res?.data?.ideas) ? res.data.ideas : [];
      setGeneratedIdeas(rawIdeas.map(normalizeGeneratedIdea).filter((idea) => idea.title));
      applyResponseContext(res);
    } catch (error: any) {
      console.error(error);
      setNotice({ type: "warning", text: error?.message || "Não foi possível gerar ideias com o contexto atual." });
    } finally {
      setIsGenerating(false);
    }
  };

  const beginDevelopment = (
    idea: {
      id?: string;
      title: string;
      hook?: string;
      format?: string;
      channel?: string;
      objective?: string;
      concept?: string;
      keyMessage?: string;
      callToAction?: string;
    },
    briefingFallback: CreationBriefing = normalizedBriefing,
  ) => {
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
    setScriptFormat(clean(idea.format) || briefingFallback.format);
    setScriptPlatform(clean(idea.channel) || briefingFallback.channel);
    setScriptObjective(clean(idea.objective) || briefingFallback.objective);
    setSourceIdeaId(idea.id);
    setSourceIdeaTitle(title);
    invalidateGeneratedScript();
    resetGenerationFeedback();
    setLibraryOpen(false);
    setStage("develop");
  };

  const resumeIdea = (idea: IdeaItem) => {
    const resumedBriefing = normalizeCreationBriefing({
      objective: idea.objective || "",
      format: idea.format || "",
      channel: idea.channel || "",
    });
    setBriefing(resumedBriefing);
    const validation = validateCreationBriefing(resumedBriefing);
    if (!validation.valid || !baseStatus.ready) {
      setLibraryOpen(false);
      setStage("briefing");
      setNotice({
        type: "warning",
        text: "A ideia foi carregada. Complete o briefing e confirme a Base antes de continuar o desenvolvimento.",
      });
      return;
    }
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
    }, resumedBriefing);
  };

  const handleSavedIdeaSelection = (ideaId: string) => {
    if (!ideaId) {
      setSourceIdeaId(undefined);
      setSourceIdeaTitle("");
      return;
    }
    const idea = ideas.find((item) => item.id === ideaId);
    if (idea) resumeIdea(idea);
  };

  const handleGenerateScript = async () => {
    if (!briefingReady) {
      setStage("briefing");
      return;
    }
    if (!scriptIdea.trim() || !scriptFormat.trim() || !scriptPlatform.trim() || !scriptObjective.trim()) return;

    setIsGenerating(true);
    resetGenerationFeedback();
    setSavedScriptId(null);
    try {
      const res = await creationGenerationClient.generateScript({
        idea: scriptIdea.trim(),
        format: scriptFormat.trim(),
        platform: scriptPlatform.trim(),
        objective: scriptObjective.trim(),
        customInstructions: briefingInstructions,
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
    } catch (error: any) {
      console.error(error);
      setNotice({ type: "warning", text: error?.message || "Não foi possível gerar o conteúdo com o contexto atual." });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveIdea = async (idea: GeneratedIdea, index: number) => {
    if (isSaving || savedIdeaIds[index]) return;
    setIsSaving(true);
    setNotice(null);
    try {
      const body = [
        `# ${idea.title}`,
        optionalMarkdown("Objetivo", idea.objective),
        optionalMarkdown("Formato", idea.format),
        optionalMarkdown("Canal", idea.channel),
        optionalMarkdown("Tema do briefing", normalizedBriefing.theme),
        optionalMarkdown("Restrições do briefing", normalizedBriefing.instructions),
        idea.hook ? `## Gancho\n${idea.hook}` : "",
        idea.concept ? `## Conceito\n${idea.concept}` : "",
        idea.keyMessage ? `## Mensagem Principal\n${idea.keyMessage}` : "",
        idea.cta ? `## CTA\n${idea.cta}` : "",
        idea.suggestedVisual ? `## Visual Sugerido\n${idea.suggestedVisual}` : "",
        idea.rationale ? `## Fundamentação\n${idea.rationale}` : "",
      ].filter(Boolean).join("\n\n");
      const markdown = buildCreativeArtifactMarkdown({
        kind: "idea",
        objective: idea.objective,
        format: idea.format,
        channel: idea.channel,
        theme: normalizedBriefing.theme,
        briefingInstructions: normalizedBriefing.instructions,
      }, body);

      await onSaveToVault(markdown, "03_Conteudos/Ideias", idea.title);
      const ideaId = `idea-${Date.now()}-${index}`;
      onAddIdea({
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
      });
      setSavedIdeaIds((current) => ({ ...current, [index]: ideaId }));
      setNotice({ type: "success", text: `Ideia “${idea.title}” salva e disponível na Biblioteca.` });
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
      const body = [
        `# ${script.title}`,
        optionalMarkdown("Objetivo", script.objective),
        optionalMarkdown("Formato", scriptFormat),
        optionalMarkdown("Plataforma", scriptPlatform),
        optionalMarkdown("Tema do briefing", normalizedBriefing.theme),
        optionalMarkdown("Restrições do briefing", normalizedBriefing.instructions),
        optionalMarkdown("Duração", script.duration),
        script.hook ? `## Gancho\n${script.hook}` : "",
        sceneMarkdown ? `## Cenas\n${sceneMarkdown}` : "",
        script.cta ? `## CTA\n${script.cta}` : "",
        script.captionSuggestion ? `## Sugestão de Legenda\n${script.captionSuggestion}` : "",
        script.productionNotes ? `## Notas de Produção\n${script.productionNotes}` : "",
        sourceIdeaTitle ? `## Origem\nIdeia: ${sourceIdeaTitle}` : "",
      ].filter(Boolean).join("\n\n");
      const markdown = buildCreativeArtifactMarkdown({
        kind: "script",
        objective: script.objective || scriptObjective.trim(),
        format: scriptFormat,
        channel: scriptPlatform,
        theme: normalizedBriefing.theme,
        briefingInstructions: normalizedBriefing.instructions,
        sourceIdeaId,
        sourceIdeaTitle: sourceIdeaTitle || undefined,
        workflowStatus: "APROVADO",
      }, body);

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
        tags: ["workflow:approved"],
        platform: scriptPlatform.trim(),
        format: scriptFormat.trim(),
        sourceIdeaId,
        sourceIdeaTitle: sourceIdeaTitle || undefined,
      };
      onAddScript(newScript);
      setSavedScriptId(scriptId);
      setNotice({
        type: "success",
        text: `Conteúdo “${script.title}” aprovado para o workflow e salvo como HIPÓTESE no Obsidian.`,
      });
    } catch (error: any) {
      setNotice({ type: "warning", text: error?.message || "Não foi possível salvar o conteúdo." });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditorialPlanning = (script: CreativeScript) => {
    if (!clean(script.format) || !clean(script.platform) || !clean(script.objective)) {
      setNotice({
        type: "warning",
        text: "Este conteúdo aprovado não possui formato, plataforma e objetivo suficientes para entrar no Calendário.",
      });
      setLibraryOpen(false);
      return;
    }

    try {
      storeEditorialPlanningHandoff({ scriptId: script.id });
      const planningButton = document.querySelector<HTMLButtonElement>('button[aria-label="Planejar"]');
      if (!planningButton) throw new Error("Não foi possível abrir o Calendário editorial.");
      planningButton.click();
    } catch (error: any) {
      setNotice({ type: "warning", text: error?.message || "Não foi possível abrir o planejamento editorial." });
    }
  };

  const openCurrentEditorialPlanning = () => {
    if (!savedScriptId) return;
    const script = scripts.find((item) => item.id === savedScriptId);
    if (!script) {
      setNotice({ type: "warning", text: "O conteúdo aprovado ainda não está disponível na Biblioteca." });
      return;
    }
    openEditorialPlanning(script);
  };

  const changeScriptField = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    setter(value);
    invalidateGeneratedScript();
  };

  const goToStage = (target: CreationStage) => {
    if (target === "briefing") {
      setStage("briefing");
      return;
    }
    if (!briefingReady) {
      setStage("briefing");
      return;
    }
    setStage(target);
  };

  const libraryAction = (entry: CreativeLibraryEntry) => {
    if (entry.status === "planned") return null;
    if (entry.status === "approved" && entry.script) {
      return (
        <button type="button" onClick={() => openEditorialPlanning(entry.script!)} className="px-3 py-2 rounded-lg border border-indigo-500/25 bg-indigo-500/10 text-indigo-300 text-[11px] font-bold flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" /> Planejar
        </button>
      );
    }
    if (entry.idea) {
      return (
        <button type="button" onClick={() => resumeIdea(entry.idea!)} className="px-3 py-2 rounded-lg border border-pink-500/25 bg-pink-500/10 text-pink-300 text-[11px] font-bold flex items-center gap-1.5">
          <Film className="w-3.5 h-3.5" /> {entry.status === "development" ? "Retomar" : "Desenvolver"}
        </button>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col text-text-primary">
      <header className="shrink-0 border-b border-outline-border px-2 pb-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Criar</h1>
            <p className="mt-1 text-xs text-text-secondary">Briefing explícito, ideias fundamentadas e desenvolvimento. O Calendário concentra as decisões de publicação.</p>
          </div>
          <button type="button" onClick={() => setLibraryOpen((open) => !open)} className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 ${libraryOpen ? "border-pink-500/35 bg-pink-500/10 text-pink-300" : "border-outline-border text-text-secondary hover:text-text-primary"}`}>
            <BookOpen className="w-4 h-4" /> Biblioteca
            {libraryCounts.total > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-background border border-outline-border flex items-center justify-center text-[10px]">{libraryCounts.total}</span>}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {([[
            "briefing", "1. Briefing", FileText,
          ], ["ideas", "2. Ideias", Lightbulb], ["develop", "3. Desenvolver", Film]] as const).map(([id, label, Icon], index) => (
            <React.Fragment key={id}>
              {index > 0 && <ArrowRight className="w-4 h-4 text-text-secondary/40" />}
              <button type="button" onClick={() => goToStage(id)} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border ${stage === id ? "border-pink-500/40 bg-pink-500/10 text-pink-300" : "border-outline-border text-text-secondary"}`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            </React.Fragment>
          ))}
        </div>
      </header>

      {notice && <div className={`mt-4 mx-2 rounded-xl border p-3 text-xs ${notice.type === "success" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-amber-500/25 bg-amber-500/10 text-amber-300"}`}>{notice.text}</div>}

      <div className="flex-1 min-h-0 overflow-y-auto p-2 pt-4">
        {libraryOpen && (
          <section className="mb-5 bg-surface-card border border-outline-border p-5 rounded-2xl">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 border-b border-outline-border pb-4">
              <div>
                <h2 className="font-bold text-lg">Biblioteca de criação</h2>
                <p className="mt-1 text-[11px] text-text-secondary max-w-2xl">Visão derivada de ideias, roteiros aprovados e itens já existentes no Calendário editorial.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="px-2.5 py-1.5 rounded-lg border border-outline-border">Ideias {libraryCounts.idea}</span>
                <span className="px-2.5 py-1.5 rounded-lg border border-outline-border">Em desenvolvimento {libraryCounts.development}</span>
                <span className="px-2.5 py-1.5 rounded-lg border border-outline-border">Aprovados {libraryCounts.approved}</span>
                <span className="px-2.5 py-1.5 rounded-lg border border-outline-border">Planejados {libraryCounts.planned}</span>
              </div>
            </div>
            {libraryEntries.length === 0 ? (
              <div className="py-10 text-center text-text-secondary"><BookOpen className="w-8 h-8 mx-auto opacity-40" /><p className="mt-3 text-sm font-bold text-text-primary">A Biblioteca ainda está vazia</p><p className="mt-1 text-xs">Salve uma ideia para iniciar o fluxo operacional.</p></div>
            ) : (
              <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-3">
                {libraryEntries.map((entry) => {
                  const status = LIBRARY_STATUS[entry.status];
                  return (
                    <article key={entry.id} className="rounded-xl border border-outline-border bg-background/35 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className={`inline-flex px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-wide ${status.className}`}>{status.label}</span>
                          <h3 className="mt-2 font-bold text-sm truncate">{entry.title}</h3>
                          <p className="mt-1 text-[10px] text-text-secondary">{[entry.script?.format || entry.idea?.format, entry.script?.platform || entry.idea?.channel, entry.script?.objective || entry.idea?.objective].filter(Boolean).join(" • ") || "Sem metadados adicionais"}</p>
                          {entry.plannedItem && <p className="mt-2 text-[10px] text-indigo-300">{entry.plannedItem.scheduledDate}{entry.plannedItem.scheduledTime ? ` às ${entry.plannedItem.scheduledTime}` : ""}{entry.plannedItem.platform ? ` • ${entry.plannedItem.platform}` : ""}</p>}
                        </div>
                        <div className="shrink-0">{libraryAction(entry)}</div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {stage === "briefing" && (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5">
            <section className="bg-surface-card border border-outline-border p-5 rounded-2xl">
              <h2 className="font-bold text-lg">Assistente de Briefing</h2>
              <p className="text-[11px] text-text-secondary mt-1 max-w-2xl">Defina somente o que você sabe e decidiu. O Nisti usa a Base para contexto, mas não preenche objetivo, formato ou canal por conta própria.</p>
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="md:col-span-2"><span className="block text-[10px] uppercase text-text-secondary font-bold mb-1">Objetivo *</span><input value={briefing.objective} onChange={(event) => updateBriefing("objective", event.target.value)} className="w-full bg-background border border-outline-border rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500/60" placeholder="Ex: apresentar uma nova linha de produto" /></label>
                <label><span className="block text-[10px] uppercase text-text-secondary font-bold mb-1">Formato *</span><input value={briefing.format} onChange={(event) => updateBriefing("format", event.target.value)} className="w-full bg-background border border-outline-border rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500/60" placeholder="Ex: Reel, carrossel, artigo" /></label>
                <label><span className="block text-[10px] uppercase text-text-secondary font-bold mb-1">Canal *</span><input value={briefing.channel} onChange={(event) => updateBriefing("channel", event.target.value)} className="w-full bg-background border border-outline-border rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500/60" placeholder="Ex: Instagram, TikTok, LinkedIn" /></label>
                <label className="md:col-span-2"><span className="block text-[10px] uppercase text-text-secondary font-bold mb-1">Tema opcional</span><input value={briefing.theme} onChange={(event) => updateBriefing("theme", event.target.value)} className="w-full bg-background border border-outline-border rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500/60" placeholder="Ex: bastidores da produção" /></label>
                <label className="md:col-span-2"><span className="block text-[10px] uppercase text-text-secondary font-bold mb-1">Restrições ou observações opcionais</span><textarea value={briefing.instructions} onChange={(event) => updateBriefing("instructions", event.target.value)} className="w-full h-28 bg-background border border-outline-border rounded-lg px-3 py-2 text-sm outline-none resize-none focus:border-pink-500/60" placeholder="Ex: não mencionar preço; evitar tom promocional; usar somente fotos reais." /></label>
              </div>
              <div className="mt-5 flex justify-end"><button type="button" disabled={!briefingReady} onClick={confirmBriefing} className="px-5 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-40">Continuar para ideias <ArrowRight className="w-4 h-4" /></button></div>
            </section>
            <aside className="bg-surface-card border border-outline-border p-5 rounded-2xl self-start">
              <h2 className="font-bold text-sm">Base usada pelo briefing</h2>
              {baseStatus.ready ? (
                <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4"><div className="flex items-center gap-2 text-emerald-300 text-xs font-bold"><Check className="w-4 h-4" />Base Inicial pronta</div><p className="mt-2 text-[11px] text-text-secondary">Os documentos canônicos estão confirmados e podem ser usados para fundamentar a criação.</p></div>
              ) : (
                <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4"><div className="flex items-center gap-2 text-amber-300 text-xs font-bold"><AlertTriangle className="w-4 h-4" />Base ainda não está pronta</div><p className="mt-2 text-[11px] text-text-secondary">{baseStatus.missingDocuments > 0 && `${baseStatus.missingDocuments} documento(s) canônico(s) ausente(s). `}{baseStatus.pendingDocuments > 0 && `${baseStatus.pendingDocuments} documento(s) precisam de revisão. `}Abra Base no menu lateral para concluir o onboarding antes de gerar conteúdo.</p></div>
              )}
              {!briefingValidation.valid && <div className="mt-3 text-[11px] text-text-secondary">Para continuar, preencha: {briefingValidation.missing.map((field) => ({ objective: "objetivo", format: "formato", channel: "canal" })[field]).join(", ")}.</div>}
            </aside>
          </div>
        )}

        {stage === "ideas" && (
          <div className="grid grid-cols-1 xl:grid-cols-[330px_minmax(0,1fr)] gap-5">
            <aside className="bg-surface-card border border-outline-border p-5 rounded-2xl self-start">
              <h2 className="font-bold text-base">Briefing confirmado</h2>
              <dl className="mt-4 space-y-3 text-xs"><div><dt className="text-text-secondary">Objetivo</dt><dd className="font-bold mt-0.5">{normalizedBriefing.objective}</dd></div><div><dt className="text-text-secondary">Formato</dt><dd className="font-bold mt-0.5">{normalizedBriefing.format}</dd></div><div><dt className="text-text-secondary">Canal</dt><dd className="font-bold mt-0.5">{normalizedBriefing.channel}</dd></div>{normalizedBriefing.theme && <div><dt className="text-text-secondary">Tema</dt><dd className="font-bold mt-0.5">{normalizedBriefing.theme}</dd></div>}{normalizedBriefing.instructions && <div><dt className="text-text-secondary">Restrições</dt><dd className="mt-0.5 leading-relaxed">{normalizedBriefing.instructions}</dd></div>}</dl>
              <button onClick={() => setStage("briefing")} className="mt-4 text-[11px] font-bold text-pink-300 hover:underline">Editar briefing</button>
              <button disabled={isGenerating} onClick={() => void handleGenerateIdeas()} className="w-full mt-5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center disabled:opacity-40">{isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-2" />Gerar {IDEA_GENERATION_COUNT} ideias</>}</button>
              <SourceTrace sources={sources} warning={contextWarning} />
            </aside>
            <section className="bg-surface-card border border-outline-border p-5 rounded-2xl min-h-[420px]">
              <div className="flex items-end justify-between gap-3 border-b border-outline-border pb-3"><div><h2 className="font-bold">Ideias propostas</h2><p className="text-[11px] text-text-secondary mt-1">Escolha uma proposta para desenvolver ou salve para retomar depois.</p></div>{generatedIdeas.length > 0 && <span className="text-[10px] text-text-secondary">{generatedIdeas.length} proposta(s)</span>}</div>
              {generatedIdeas.length === 0 && !isGenerating ? (
                <div className="min-h-72 flex flex-col items-center justify-center text-center text-text-secondary"><Lightbulb className="w-8 h-8 opacity-40" /><p className="mt-3 text-sm font-bold text-text-primary">Briefing pronto para gerar ideias</p><p className="mt-1 text-xs max-w-md">O Nisti consulta a Base e mantém as decisões do briefing explícitas.</p></div>
              ) : (
                <div className="mt-4 space-y-4">{generatedIdeas.map((idea, index) => (
                  <article key={`${idea.title}-${index}`} className="border border-outline-border bg-background/35 p-5 rounded-xl">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4"><div className="min-w-0"><h3 className="font-bold text-lg">{idea.title}</h3><div className="mt-2 flex flex-wrap gap-2 text-[10px] text-text-secondary">{idea.format && <span className="px-2 py-1 rounded-full border border-outline-border">{idea.format}</span>}{idea.channel && <span className="px-2 py-1 rounded-full border border-outline-border">{idea.channel}</span>}{idea.objective && <span className="px-2 py-1 rounded-full border border-outline-border">{idea.objective}</span>}</div></div><div className="flex flex-wrap gap-2 shrink-0"><button type="button" onClick={() => beginDevelopment({ id: savedIdeaIds[index], title: idea.title, hook: idea.hook, format: idea.format, channel: idea.channel, objective: idea.objective, concept: idea.concept, keyMessage: idea.keyMessage, callToAction: idea.cta })} className="px-3 py-2 rounded-lg bg-pink-500/15 border border-pink-500/25 text-pink-300 text-xs font-bold flex items-center gap-1.5">Desenvolver <ArrowRight className="w-3.5 h-3.5" /></button><button disabled={isSaving || Boolean(savedIdeaIds[index])} onClick={() => void handleSaveIdea(idea, index)} className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">{savedIdeaIds[index] ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}{savedIdeaIds[index] ? "Salva" : "Salvar"}</button></div></div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">{idea.hook && <div><span className="text-text-secondary block mb-1">Gancho</span><span>{idea.hook}</span></div>}{idea.keyMessage && <div><span className="text-text-secondary block mb-1">Mensagem principal</span><span>{idea.keyMessage}</span></div>}{idea.concept && <div className="md:col-span-2"><span className="text-text-secondary block mb-1">Conceito</span><span>{idea.concept}</span></div>}</div>
                  </article>
                ))}</div>
              )}
            </section>
          </div>
        )}

        {stage === "develop" && (
          <div className="grid grid-cols-1 xl:grid-cols-[350px_minmax(0,1fr)] gap-5">
            <aside className="bg-surface-card border border-outline-border p-5 rounded-2xl self-start">
              <h2 className="font-bold text-base">Desenvolver conteúdo</h2><p className="text-[11px] text-text-secondary mt-1">Continue uma ideia gerada ou retome uma ideia já salva.</p>
              <label className="block mt-5"><span className="block text-[10px] uppercase text-text-secondary font-bold mb-1">Ideias salvas</span><select value={sourceIdeaId || ""} onChange={(event) => handleSavedIdeaSelection(event.target.value)} className="w-full bg-background border border-outline-border rounded-lg px-3 py-2 text-sm outline-none"><option value="">Nenhuma ideia salva selecionada</option>{savedIdeaOptions.map((idea) => <option key={idea.id} value={idea.id}>{idea.title}</option>)}</select></label>
              <div className="mt-4 space-y-4">
                <label className="block"><span className="block text-[10px] uppercase text-text-secondary font-bold mb-1">Ideia / briefing</span><textarea value={scriptIdea} onChange={(event) => changeScriptField(setScriptIdea, event.target.value)} className="w-full h-36 bg-background border border-outline-border rounded-lg px-3 py-2 text-sm outline-none resize-none focus:border-pink-500/60" placeholder="Escolha uma ideia ou descreva o conteúdo que deseja desenvolver." /></label>
                <label className="block"><span className="block text-[10px] uppercase text-text-secondary font-bold mb-1">Objetivo</span><input value={scriptObjective} onChange={(event) => changeScriptField(setScriptObjective, event.target.value)} className="w-full bg-background border border-outline-border rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500/60" /></label>
                <label className="block"><span className="block text-[10px] uppercase text-text-secondary font-bold mb-1">Formato</span><input value={scriptFormat} onChange={(event) => changeScriptField(setScriptFormat, event.target.value)} className="w-full bg-background border border-outline-border rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500/60" /></label>
                <label className="block"><span className="block text-[10px] uppercase text-text-secondary font-bold mb-1">Plataforma</span><input value={scriptPlatform} onChange={(event) => changeScriptField(setScriptPlatform, event.target.value)} className="w-full bg-background border border-outline-border rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500/60" /></label>
              </div>
              <button disabled={isGenerating || !scriptIdea.trim() || !scriptObjective.trim() || !scriptFormat.trim() || !scriptPlatform.trim()} onClick={() => void handleGenerateScript()} className="w-full mt-5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center disabled:opacity-40">{isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-2" />Gerar conteúdo</>}</button>
              {sourceIdeaTitle && <div className="mt-3 rounded-lg border border-outline-border bg-background/40 p-3 text-[11px] text-text-secondary">Origem: <strong className="text-text-primary">{sourceIdeaTitle}</strong></div>}
              <SourceTrace sources={sources} warning={contextWarning} />
            </aside>
            <section className="bg-surface-card border border-outline-border p-5 rounded-2xl min-h-[420px]">
              <div className="border-b border-outline-border pb-3"><h2 className="font-bold">Conteúdo desenvolvido</h2><p className="text-[11px] text-text-secondary mt-1">Aprovar e salvar é uma decisão de workflow. O conteúdo continua HIPÓTESE no Obsidian até validação factual.</p></div>
              {!generatedScript && !isGenerating ? (
                <div className="min-h-72 flex flex-col items-center justify-center text-center text-text-secondary"><Film className="w-8 h-8 opacity-40" /><p className="mt-3 text-sm font-bold text-text-primary">Nenhum conteúdo desenvolvido ainda</p><p className="mt-1 text-xs max-w-md">Escolha uma ideia e gere uma peça com o briefing confirmado.</p></div>
              ) : generatedScript ? (
                <article className="mt-4 border border-outline-border bg-background/35 p-5 rounded-xl">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4"><div><h3 className="font-bold text-xl">{generatedScript.title}</h3><p className="text-xs text-text-secondary mt-1">{[generatedScript.duration, generatedScript.objective, scriptPlatform].filter(Boolean).join(" • ")}</p></div><div className="flex flex-wrap gap-2 shrink-0"><button disabled={isSaving || Boolean(savedScriptId)} onClick={() => void handleSaveScript(generatedScript)} className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">{savedScriptId ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}{savedScriptId ? "Aprovado e salvo" : "Aprovar e salvar"}</button><button disabled={!savedScriptId} onClick={openCurrentEditorialPlanning} title={!savedScriptId ? "Aprove e salve o conteúdo antes de planejar" : "Abrir este conteúdo no Calendário"} className="px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"><Calendar className="w-3.5 h-3.5" /> Planejar</button></div></div>
                  {generatedScript.hook && <div className="mt-5"><h4 className="text-[10px] text-text-secondary font-bold uppercase mb-2">Gancho</h4><p className="text-sm bg-background/60 p-3 rounded-lg border border-outline-border">{generatedScript.hook}</p></div>}
                  {generatedScript.scenes.length > 0 && <div className="mt-5 space-y-3"><h4 className="text-[10px] text-text-secondary font-bold uppercase">Cenas / etapas</h4>{generatedScript.scenes.map((scene, index) => <div key={`${scene.order}-${index}`} className="bg-background/50 p-4 rounded-lg border border-outline-border flex gap-4"><div className="shrink-0 w-8 h-8 rounded-full bg-pink-500/10 text-pink-300 flex items-center justify-center font-bold text-xs">{scene.order}</div><div className="text-sm space-y-2 flex-1 min-w-0">{scene.visual && <div><span className="text-text-secondary mr-2 text-xs">Visual:</span><span>{scene.visual}</span></div>}{scene.narration && <div><span className="text-text-secondary mr-2 text-xs">Narração:</span><span>{scene.narration}</span></div>}{scene.onScreenText && <div><span className="text-text-secondary mr-2 text-xs">Tela:</span><span>{scene.onScreenText}</span></div>}</div>{scene.duration && <div className="shrink-0 text-[10px] text-text-secondary mt-1">{scene.duration}</div>}</div>)}</div>}
                  {generatedScript.cta && <div className="mt-5"><h4 className="text-[10px] text-text-secondary font-bold uppercase mb-2">CTA</h4><p className="text-sm bg-background/60 p-3 rounded-lg border border-outline-border">{generatedScript.cta}</p></div>}
                </article>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
