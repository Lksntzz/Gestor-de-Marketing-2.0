import React, { useState } from "react";
import { Lightbulb, Film, Plus, Loader2, Save, FileText, Check, AlertTriangle, Sparkles } from "lucide-react";
import type { IdeaItem, CreativeScript, ObsidianNote } from "../types";
import { api } from "../services/api";

interface ContentViewProps {
  ideas: IdeaItem[];
  scripts: CreativeScript[];
  notes: ObsidianNote[];
  onAddIdea: (idea: IdeaItem) => void;
  onAddScript: (script: CreativeScript) => void;
  onSaveToVault: (content: string, folder: string, title: string) => Promise<void>;
  engineMode: string;
}

export const ContentView: React.FC<ContentViewProps> = ({ ideas, scripts, notes, onAddIdea, onAddScript, onSaveToVault, engineMode }) => {
  const [activeTab, setActiveTab] = useState<"ideias" | "roteiros">("ideias");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Ideas Form
  const [ideaObjective, setIdeaObjective] = useState("");
  const [ideaFormat, setIdeaFormat] = useState("Post de Instagram");
  const [ideaChannel, setIdeaChannel] = useState("Instagram");
  
  // Script Form
  const [scriptIdea, setScriptIdea] = useState("");
  const [scriptFormat, setScriptFormat] = useState("Reel");
  const [scriptPlatform, setScriptPlatform] = useState("Instagram");
  
  // State for generated content
  const [generatedIdeas, setGeneratedIdeas] = useState<any[]>([]);
  const [generatedScript, setGeneratedScript] = useState<any | null>(null);
  
  // Sources
  const [sources, setSources] = useState<any[]>([]);
  const [contextWarning, setContextWarning] = useState("");

  const handleGenerateIdeas = async () => {
    setIsGenerating(true);
    setSources([]);
    setContextWarning("");
    setSavedIds(new Set()); // reset saves
    try {
      const res = await api.generateIdeas({
        objective: ideaObjective,
        format: ideaFormat,
        channel: ideaChannel,
        count: 3,
        engineMode,
        knowledgeNotes: notes
      });
      if (res.data?.ideas) {
        setGeneratedIdeas(res.data.ideas);
      }
      if (res.sources) setSources(res.sources);
      if (res.wasFallback) {
        setContextWarning("Modo offline/fallback ativado. Conteúdo gerado localmente sem consultar a inteligência remota.");
      } else if (res.contextWarning) {
        setContextWarning(res.contextWarning);
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao gerar ideias.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateScript = async () => {
    setIsGenerating(true);
    setSources([]);
    setContextWarning("");
    setSavedIds(new Set());
    try {
      const res = await api.generateScript({
        idea: scriptIdea,
        format: scriptFormat,
        platform: scriptPlatform,
        objective: "Engajamento",
        engineMode,
        knowledgeNotes: notes
      });
      if (res.data) {
        setGeneratedScript(res.data);
      }
      if (res.sources) setSources(res.sources);
      if (res.wasFallback) {
        setContextWarning("Modo offline/fallback ativado. Conteúdo gerado localmente sem consultar a inteligência remota.");
      } else if (res.contextWarning) {
        setContextWarning(res.contextWarning);
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao gerar roteiro.");
    } finally {
      setIsGenerating(false);
    }
  };
  
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveIdea = async (idea: any, index: number) => {
    if (isSaving || savedIds.has(`idea-${index}`)) return;
    setIsSaving(true);
    try {
      const markdown = `# ${idea.title}\n\n**Formato:** ${idea.format}\n**Canal:** ${idea.channel}\n**Objetivo:** ${idea.objective}\n\n## Gancho\n${idea.hook}\n\n## Conceito\n${idea.concept}\n\n## Mensagem Principal\n${idea.keyMessage}\n\n## CTA\n${idea.cta}\n\n## Visual Sugerido\n${idea.suggestedVisual}\n\n## Rationale\n${idea.rationale}`;
      await onSaveToVault(markdown, "03_Conteudos/Ideias", idea.title);
      
      const newIdea: IdeaItem = {
        id: "idea-" + Date.now(),
        title: idea.title,
        category: "redes",
        impact: "medio",
        status: "ideia",
        targetPersona: "",
        hook: idea.hook,
        tags: [],
      };
      onAddIdea(newIdea);
      setSavedIds(prev => new Set(prev).add(`idea-${index}`));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveScript = async (script: any) => {
    if (isSaving || savedIds.has(`script-0`)) return;
    setIsSaving(true);
    try {
      let markdown = `# ${script.title}\n\n**Objetivo:** ${script.objective}\n**Duração:** ${script.duration}\n\n## Gancho\n${script.hook}\n\n## Cenas\n`;
      script.scenes.forEach((s: any) => {
        markdown += `### Cena ${s.order} (${s.duration})\n**Visual:** ${s.visual}\n**Áudio/Narração:** ${s.narration}\n**Texto na Tela:** ${s.onScreenText}\n\n`;
      });
      markdown += `## CTA\n${script.cta}\n\n## Sugestão de Legenda\n${script.captionSuggestion}\n\n## Notas de Produção\n${script.productionNotes}`;
      
      await onSaveToVault(markdown, "03_Conteudos/Roteiros", script.title);
      
      const newScript: CreativeScript = {
        id: "script-" + Date.now(),
        title: script.title,
        type: "video_reels",
        durationOrSlides: script.duration,
        objective: script.objective,
        targetAudience: "",
        hookScene: script.hook,
        bodyScenes: script.scenes.map((s:any) => ({ step: `Cena ${s.order}`, visualCues: s.visual, audioOrNarration: s.narration })),
        callToAction: script.cta,
        tags: []
      };
      onAddScript(newScript);
      setSavedIds(prev => new Set(prev).add(`script-0`));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-4 border-b border-white/10 px-6 py-4">
        <button onClick={() => setActiveTab("ideias")} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === "ideias" ? "bg-pink-500/20 text-pink-500" : "text-stone-400 hover:text-white"}`}><Lightbulb className="w-4 h-4 inline-block mr-2"/>Ideias</button>
        <button onClick={() => setActiveTab("roteiros")} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === "roteiros" ? "bg-pink-500/20 text-pink-500" : "text-stone-400 hover:text-white"}`}><Film className="w-4 h-4 inline-block mr-2"/>Roteiros</button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 flex gap-6">
        <div className="w-1/3 bg-[#111322] border border-white/5 p-5 rounded-2xl flex flex-col gap-4 self-start">
          <h2 className="text-white font-bold text-lg mb-2">Gerar {activeTab === "ideias" ? "Ideias" : "Roteiro"}</h2>
          
          {activeTab === "ideias" ? (
            <>
              <div>
                <label className="block text-[10px] uppercase text-stone-500 font-bold mb-1">Objetivo</label>
                <input value={ideaObjective} onChange={e=>setIdeaObjective(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="Ex: Vender produto X" />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-stone-500 font-bold mb-1">Formato</label>
                <input value={ideaFormat} onChange={e=>setIdeaFormat(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="Ex: Post Carrossel" />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-stone-500 font-bold mb-1">Canal</label>
                <input value={ideaChannel} onChange={e=>setIdeaChannel(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="Ex: Instagram" />
              </div>
              <button disabled={isGenerating || !ideaObjective} onClick={handleGenerateIdeas} className="w-full mt-4 bg-pink-600 hover:bg-pink-500 text-white rounded-xl py-3 font-bold text-sm transition-colors flex items-center justify-center disabled:opacity-50">
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-2" /> Gerar com IA</>}
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="block text-[10px] uppercase text-stone-500 font-bold mb-1">Ideia / Título</label>
                <input value={scriptIdea} onChange={e=>setScriptIdea(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="Ex: Bastidores da agência" />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-stone-500 font-bold mb-1">Formato</label>
                <input value={scriptFormat} onChange={e=>setScriptFormat(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="Ex: Reel" />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-stone-500 font-bold mb-1">Plataforma</label>
                <input value={scriptPlatform} onChange={e=>setScriptPlatform(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="Ex: Instagram" />
              </div>
              <button disabled={isGenerating || !scriptIdea} onClick={handleGenerateScript} className="w-full mt-4 bg-pink-600 hover:bg-pink-500 text-white rounded-xl py-3 font-bold text-sm transition-colors flex items-center justify-center disabled:opacity-50">
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-2" /> Gerar com IA</>}
              </button>
            </>
          )}

          {sources.length > 0 && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <h3 className="text-xs text-stone-400 font-bold mb-2">Baseado em {sources.length} fontes do Vault:</h3>
              <ul className="text-[11px] text-stone-500 space-y-1">
                {sources.map((s, i) => (
                  <li key={i} className="truncate">• {s.title} {s.epistemicStatus ? `(${s.epistemicStatus})` : ''}</li>
                ))}
              </ul>
            </div>
          )}
          {contextWarning && (
            <div className="mt-2 text-[11px] text-amber-500 bg-amber-500/10 p-2 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p>{contextWarning}</p>
            </div>
          )}
        </div>
        
        <div className="flex-1 bg-black/20 border border-white/5 p-6 rounded-2xl overflow-y-auto">
          {activeTab === "ideias" ? (
            <div className="space-y-6">
              {generatedIdeas.length === 0 && !isGenerating && (
                <div className="text-center text-stone-500 py-10">Preencha o formulário para gerar ideias com base no seu Vault.</div>
              )}
              {generatedIdeas.map((idea, i) => (
                <div key={i} className="bg-[#111322] border border-white/10 p-5 rounded-xl">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-white font-bold text-lg">{idea.title}</h3>
                    <button disabled={isSaving || savedIds.has(`idea-${i}`)} onClick={() => handleSaveIdea(idea, i)} className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <Save className="w-3 h-3" /> {savedIds.has(`idea-${i}`) ? 'Salvo' : 'Salvar no Obsidian'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div><span className="text-stone-500 block mb-1">Formato</span><span className="text-stone-300">{idea.format} no {idea.channel}</span></div>
                    <div><span className="text-stone-500 block mb-1">Gancho</span><span className="text-stone-300">{idea.hook}</span></div>
                    <div className="col-span-2"><span className="text-stone-500 block mb-1">Conceito</span><span className="text-stone-300">{idea.concept}</span></div>
                    <div className="col-span-2"><span className="text-stone-500 block mb-1">Mensagem Principal</span><span className="text-stone-300">{idea.keyMessage}</span></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {!generatedScript && !isGenerating && (
                <div className="text-center text-stone-500 py-10">Preencha o formulário para gerar um roteiro.</div>
              )}
              {generatedScript && (
                <div className="bg-[#111322] border border-white/10 p-5 rounded-xl">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-white font-bold text-xl">{generatedScript.title}</h3>
                      <p className="text-xs text-stone-400 mt-1">{generatedScript.duration} • {generatedScript.objective}</p>
                    </div>
                    <button disabled={isSaving || savedIds.has(`script-0`)} onClick={() => handleSaveScript(generatedScript)} className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <Save className="w-3 h-3" /> {savedIds.has(`script-0`) ? 'Salvo' : 'Salvar no Obsidian'}
                    </button>
                  </div>
                  
                  <div className="mb-6">
                    <h4 className="text-xs text-stone-500 font-bold uppercase mb-2">Gancho (3 segundos)</h4>
                    <p className="text-sm text-stone-300 bg-black/30 p-3 rounded-lg border border-white/5">{generatedScript.hook}</p>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    <h4 className="text-xs text-stone-500 font-bold uppercase mb-2">Cenas</h4>
                    {generatedScript.scenes?.map((scene: any, i: number) => (
                      <div key={i} className="bg-black/20 p-4 rounded-lg border border-white/5 flex gap-4">
                        <div className="shrink-0 w-8 h-8 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center font-bold text-xs">{scene.order}</div>
                        <div className="text-sm space-y-2 flex-1">
                          <div><span className="text-stone-500 mr-2 text-xs">Visual:</span><span className="text-stone-300">{scene.visual}</span></div>
                          <div><span className="text-stone-500 mr-2 text-xs">Narração:</span><span className="text-stone-300">{scene.narration}</span></div>
                        </div>
                        <div className="shrink-0 text-[10px] text-stone-500 mt-1">{scene.duration}</div>
                      </div>
                    ))}
                  </div>
                  
                  <div>
                    <h4 className="text-xs text-stone-500 font-bold uppercase mb-2">Call to Action (CTA)</h4>
                    <p className="text-sm text-stone-300 bg-black/30 p-3 rounded-lg border border-white/5">{generatedScript.cta}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
