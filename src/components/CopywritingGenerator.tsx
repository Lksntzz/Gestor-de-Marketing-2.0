import React, { useState } from "react";
import {
  Sparkles,
  Layers,
  Copy,
  Check,
  Save,
  Loader2,
  FileCheck2,
  AlertTriangle,
  Send,
  BookOpen,
} from "lucide-react";
import type { ObsidianNote } from "../types";
import { creationGenerationClient } from "../services/creationGenerationClient";
import type {
  CopywritingFramework,
  GroundedCopywritingResult,
} from "../domain/creativeGenerators";
import { getCopywritingFrameworkPrompt } from "../domain/creativeGenerators";
import { buildCreativeArtifactMarkdown } from "../utils/contentWorkflow";

interface CopywritingGeneratorProps {
  notes: ObsidianNote[];
  onSaveToVault: (content: string, folder: string, title: string) => Promise<void>;
  engineMode: string;
  defaultChannel?: string;
  defaultObjective?: string;
}

const FRAMEWORKS: Array<{ value: CopywritingFramework; label: string; description: string }> = [
  {
    value: "AIDA",
    label: "AIDA",
    description: "Atenção -> Interesse -> Desejo -> Ação. Clássico para conversão.",
  },
  {
    value: "PAS",
    label: "PAS",
    description: "Problema -> Agitação -> Solução comprovada no Vault.",
  },
  {
    value: "BAB",
    label: "BAB",
    description: "Before (Antes) -> After (Depois) -> Bridge (Ponte / Solução).",
  },
  {
    value: "DIRECT_RESPONSE",
    label: "Resposta Direta",
    description: "Foco em clareza imediata, fatos reais e quebra de objeções.",
  },
  {
    value: "STORYTELLING",
    label: "Storytelling",
    description: "Arco narrativo com lição prática e aplicação real da marca.",
  },
];

export const CopywritingGenerator: React.FC<CopywritingGeneratorProps> = ({
  notes,
  onSaveToVault,
  engineMode,
  defaultChannel = "Instagram Feed / Carrossel",
  defaultObjective = "Educar e Construir Autoridade",
}) => {
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState("Carrossel de Conteúdo");
  const [channel, setChannel] = useState(defaultChannel);
  const [objective, setObjective] = useState(defaultObjective);
  const [framework, setFramework] = useState<CopywritingFramework>("DIRECT_RESPONSE");
  const [targetAudience, setTargetAudience] = useState("");
  const [tone, setTone] = useState("Técnico, seguro e empático");
  const [customInstructions, setCustomInstructions] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<GroundedCopywritingResult | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [contextWarning, setContextWarning] = useState("");
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [copiedSectionIndex, setCopiedSectionIndex] = useState<number | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !channel.trim() || !objective.trim()) return;

    setIsGenerating(true);
    setResult(null);
    setSavedPath(null);
    setContextWarning("");
    setSources([]);

    try {
      const frameworkInstructions = getCopywritingFrameworkPrompt(framework);
      const combinedInstructions = [
        frameworkInstructions,
        customInstructions.trim(),
      ]
        .filter(Boolean)
        .join("\n\n");

      const response = await creationGenerationClient.generateCopywriting({
        title: title.trim(),
        format: format.trim(),
        channel: channel.trim(),
        objective: objective.trim(),
        framework,
        targetAudience: targetAudience.trim() || undefined,
        tone: tone.trim() || undefined,
        customInstructions: combinedInstructions || undefined,
        knowledgeNotes: notes,
      });

      if (response?.data) {
        setResult(response.data as GroundedCopywritingResult);
      }
      if (Array.isArray(response?.sources)) {
        setSources(response.sources);
      }
      if (response?.contextWarning) {
        setContextWarning(response.contextWarning);
      }
    } catch (err: any) {
      setContextWarning(err?.message || "Erro ao gerar copy fundamentada.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToVault = async () => {
    if (!result) return;
    setIsSaving(true);
    try {
      const markdownBody = [
        `# ${result.title}`,
        "",
        `> **Framework:** ${result.framework} | **Canal:** ${result.channel} | **Formato:** ${result.format}`,
        `> **Objetivo:** ${result.objective}`,
        "",
        "## 🎣 Gancho / Headline",
        result.hook,
        "",
        "## 📝 Desenvolvimento",
        ...result.sections.map((sec) => `### ${sec.title}\n\n${sec.content}\n`),
        "## 🎯 Chamada para Ação (CTA)",
        result.callToAction,
        "",
        result.suggestedHashtagsOrKeywords?.length
          ? `## 🏷️ Palavras-chave / Tags Sugeridas\n${result.suggestedHashtagsOrKeywords.map((k) => `- ${k}`).join("\n")}\n`
          : "",
        result.productionNotes ? `## 💡 Notas de Produção\n${result.productionNotes}\n` : "",
        result.sourceAttribution?.length
          ? `## 📚 Fontes e Notas Referenciadas\n${result.sourceAttribution.map((s) => `- ${s}`).join("\n")}`
          : "",
      ].filter(Boolean).join("\n");

      const fullMarkdown = buildCreativeArtifactMarkdown(
        {
          kind: "script",
          objective: result.objective,
          format: result.format,
          channel: result.channel,
          theme: result.title,
          workflowStatus: "APROVADO",
        },
        markdownBody
      );

      const cleanFileName = result.title.replace(/[<>:"/\\|?*]/g, "-").slice(0, 80);
      await onSaveToVault(fullMarkdown, "03_Conteudos/Copies", cleanFileName);
      setSavedPath(`03_Conteudos/Copies/${cleanFileName}.md`);
    } catch (err: any) {
      setContextWarning(err?.message || "Falha ao salvar a copy no Vault.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyText = (text: string, index: number) => {
    void navigator.clipboard.writeText(text);
    setCopiedSectionIndex(index);
    setTimeout(() => setCopiedSectionIndex(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface-elevated/40 border border-outline-border/60 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                Gerador de Copywriting & Redação Persuasiva
              </h2>
              <p className="text-xs text-text-secondary">
                Redige textos de alta conversão fundamentados diretamente nos fatos e diretrizes do seu Vault.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-surface-card border border-outline-border text-text-secondary">
            Framework: {framework}
          </span>
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Tema / Título da Copy *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Como escolher o acabamento ideal para embalagens de luxo"
                className="w-full bg-surface-card border border-outline-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-pink-500/50"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Formato do Conteúdo
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full bg-surface-card border border-outline-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-pink-500/50"
              >
                <option value="Carrossel de Conteúdo">Carrossel de Conteúdo (Slides)</option>
                <option value="Post de Feed / Legenda Longa">Post de Feed / Legenda Longa</option>
                <option value="Artigo / Blog Post">Artigo / Blog Post</option>
                <option value="Email / Newsletter">Email / Newsletter</option>
                <option value="Landing Page / Seção de Vendas">Landing Page / Seção de Vendas</option>
                <option value="Anúncio / Copy Direta">Anúncio / Copy Direta</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Canal de Distribuição
              </label>
              <input
                type="text"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="Ex: Instagram, LinkedIn, E-mail, Site"
                className="w-full bg-surface-card border border-outline-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-pink-500/50"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Objetivo Estratégico
              </label>
              <input
                type="text"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Ex: Gerar leads qualificados B2B, Quebrar objeção de preço"
                className="w-full bg-surface-card border border-outline-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-pink-500/50"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Público-Alvo / ICP
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="Ex: Donos de gráficas, Gestores de marcas, Designers"
                className="w-full bg-surface-card border border-outline-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-pink-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Estrutura / Framework de Copywriting
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {FRAMEWORKS.map((fw) => {
                const isSelected = framework === fw.value;
                return (
                  <button
                    key={fw.value}
                    type="button"
                    onClick={() => setFramework(fw.value)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-pink-500/60 bg-pink-500/10 text-text-primary"
                        : "border-outline-border bg-surface-card/60 text-text-secondary hover:border-outline-border/80 hover:text-text-primary"
                    }`}
                  >
                    <div className="font-semibold text-xs mb-1 flex items-center justify-between">
                      <span>{fw.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-pink-400" />}
                    </div>
                    <div className="text-[11px] leading-relaxed opacity-80 line-clamp-2">
                      {fw.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Tom de Voz
              </label>
              <input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="Ex: Autoritário, empático, direto, provocativo"
                className="w-full bg-surface-card border border-outline-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-pink-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Instruções Específicas / Detalhes de Oferta
              </label>
              <input
                type="text"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Ex: Mencionar a garantia de 30 dias e a amostra grátis"
                className="w-full bg-surface-card border border-outline-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-pink-500/50"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isGenerating || !title.trim()}
              className="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50 shadow-sm shadow-pink-500/20"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Gerando Copy Fundamentada...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Gerar Copy com RAG
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {contextWarning && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Aviso Epistêmico de Grounding</p>
            <p className="opacity-90">{contextWarning}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-surface-elevated/40 border border-outline-border/70 rounded-2xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-border">
            <div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-md">
                {result.framework} • {result.channel}
              </span>
              <h3 className="text-lg font-bold text-text-primary mt-1.5">{result.title}</h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveToVault}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-surface-card border border-outline-border hover:border-pink-500/40 text-text-primary text-xs font-semibold flex items-center gap-2 transition-all"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 text-pink-400" />
                )}
                {savedPath ? "Salvo no Vault!" : "Salvar no Vault"}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-surface-card border border-outline-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-pink-400 flex items-center gap-1.5">
                  🎣 Gancho / Headline
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyText(result.hook, -1)}
                  className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1"
                >
                  {copiedSectionIndex === -1 ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  {copiedSectionIndex === -1 ? "Copiado" : "Copiar"}
                </button>
              </div>
              <p className="text-sm text-text-primary font-medium">{result.hook}</p>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                Corpo da Copy
              </h4>
              {result.sections.map((section, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-surface-card border border-outline-border space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-primary">
                      {idx + 1}. {section.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(section.content, idx)}
                      className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1"
                    >
                      {copiedSectionIndex === idx ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      {copiedSectionIndex === idx ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                  <div className="text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">
                    {section.content}
                  </div>
                  {section.guidelines && (
                    <p className="text-[11px] text-pink-400/80 italic border-t border-outline-border/40 pt-2">
                      💡 Diretriz visual/estratégica: {section.guidelines}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-surface-card border border-outline-border">
              <span className="text-xs font-bold text-emerald-400 block mb-1.5">
                🎯 Chamada para Ação (CTA)
              </span>
              <p className="text-xs text-text-primary font-medium">{result.callToAction}</p>
            </div>

            {result.productionNotes && (
              <div className="p-4 rounded-xl bg-surface-card/60 border border-outline-border/60">
                <span className="text-xs font-bold text-text-secondary block mb-1">
                  💡 Notas de Produção & Ajustes
                </span>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {result.productionNotes}
                </p>
              </div>
            )}

            {sources.length > 0 && (
              <div className="pt-2 border-t border-outline-border/60">
                <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block mb-2">
                  Fontes do Vault Utilizadas ({sources.length})
                </span>
                <div className="flex flex-wrap gap-2">
                  {sources.map((s, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] px-2.5 py-1 rounded-md bg-surface-card border border-outline-border text-text-secondary"
                    >
                      📄 {s.title || s.path}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};