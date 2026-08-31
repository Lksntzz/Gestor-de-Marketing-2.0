import React, { useState, useRef } from "react";
import {
  Image as ImageIcon,
  UploadCloud,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileCheck,
  Save,
  Tag,
  Lightbulb,
} from "lucide-react";
import type { ObsidianNote } from "../types";
import { creationGenerationClient } from "../services/creationGenerationClient";
import type { AssetAnalysisResult } from "../domain/creativeGenerators";
import { buildCreativeArtifactMarkdown } from "../utils/contentWorkflow";

interface CreativeAssetAnalyzerProps {
  notes: ObsidianNote[];
  onSaveToVault: (content: string, folder: string, title: string) => Promise<void>;
  engineMode: string;
}

export const CreativeAssetAnalyzer: React.FC<CreativeAssetAnalyzerProps> = ({
  notes,
  onSaveToVault,
  engineMode,
}) => {
  const [assetTitle, setAssetTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState("");

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<AssetAnalysisResult | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [contextWarning, setContextWarning] = useState("");
  const [savedPath, setSavedPath] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFileName(file.name);
    if (!assetTitle) {
      setAssetTitle(file.name.replace(/\.[^/.]+$/, ""));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePreview) return;

    setIsAnalyzing(true);
    setResult(null);
    setSavedPath(null);
    setContextWarning("");

    try {
      const response = await creationGenerationClient.analyzeCreativeAsset({
        title: assetTitle.trim() || imageFileName,
        imageBase64: imagePreview,
        objective: objective.trim() || undefined,
        customInstructions: customInstructions.trim() || undefined,
        knowledgeNotes: notes,
      });

      if (response?.data) {
        setResult(response.data as AssetAnalysisResult);
      }
      if (Array.isArray(response?.sources)) {
        setSources(response.sources);
      }
      if (response?.contextWarning) {
        setContextWarning(response.contextWarning);
      }
    } catch (err: any) {
      setContextWarning(err?.message || "Erro ao analisar o ativo visual.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveToVault = async () => {
    if (!result) return;
    setIsSaving(true);
    try {
      const markdownBody = [
        `# Análise de Ativo: ${result.assetTitle}`,
        "",
        `> **Status Epistêmico:** ${result.epistemicStatus}`,
        "",
        "## 👁️ Resumo Visual e Composição",
        result.visualSummary,
        "",
        "## 🔍 Elementos Detectados",
        ...result.detectedElements.map((el) => `- ${el}`),
        "",
        "## 💡 Ângulos de Conteúdo Sugeridos",
        ...result.suggestedAngles.map((ang) => `- ${ang}`),
        "",
        "## 🎣 Ganchos Potenciais",
        ...result.potentialHooks.map((hk) => `- "${hk}"`),
        "",
        "## 📱 Canais Recomendados",
        ...result.recommendedChannels.map((ch) => `- ${ch}`),
        "",
        result.hypotheses?.length
          ? `## 🧪 Hipóteses Estratégicas\n${result.hypotheses.map((h) => `- ${h}`).join("\n")}\n`
          : "",
      ].join("\n");

      const fullMarkdown = buildCreativeArtifactMarkdown(
        {
          kind: "idea",
          objective: objective || "Análise de Ativo Visual",
          theme: result.assetTitle,
          workflowStatus: "APROVADO",
        },
        markdownBody
      );

      const cleanFileName = `Analise-${result.assetTitle.replace(/[<>:"/\\|?*]/g, "-").slice(0, 70)}`;
      await onSaveToVault(fullMarkdown, "02_Conteudo/Ativos", cleanFileName);
      setSavedPath(`02_Conteudo/Ativos/${cleanFileName}.md`);
    } catch (err: any) {
      setContextWarning(err?.message || "Falha ao salvar a análise no Vault.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface-elevated/40 border border-outline-border/60 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Análise e Auditoria de Ativos Criativos
            </h2>
            <p className="text-xs text-text-secondary">
              Carregue criativos, banners ou fotos de produtos para auditar aderência visual, sugerir ganchos e cruzar com o Vault.
            </p>
          </div>
        </div>

        <form onSubmit={handleAnalyze} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Ativo Visual (Imagem PNG, JPG, WebP) *
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-outline-border hover:border-pink-500/50 bg-surface-card/50 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
              >
                {imagePreview ? (
                  <div className="space-y-2 flex flex-col items-center">
                    <img
                      src={imagePreview}
                      alt="Prévia do ativo"
                      className="max-h-48 rounded-xl object-contain border border-outline-border shadow-sm"
                    />
                    <span className="text-xs text-text-secondary font-medium">
                      {imageFileName} (Clique para trocar)
                    </span>
                  </div>
                ) : (
                  <>
                    <UploadCloud className="w-8 h-8 text-pink-400 opacity-80" />
                    <p className="text-xs text-text-primary font-semibold">
                      Clique para selecionar ou arraste uma imagem
                    </p>
                    <p className="text-[11px] text-text-secondary">
                      Suporta PNG, JPG, WEBP até 15MB
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Nome / Título do Ativo
              </label>
              <input
                type="text"
                value={assetTitle}
                onChange={(e) => setAssetTitle(e.target.value)}
                placeholder="Ex: Embalagem Premium Fosca com Hot Stamping"
                className="w-full bg-surface-card border border-outline-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-pink-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Objetivo Desejado para o Ativo
              </label>
              <input
                type="text"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Ex: Lançamento no Instagram, Anúncio de Vendas"
                className="w-full bg-surface-card border border-outline-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-pink-500/50"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Instruções de Análise / Foco Específico
              </label>
              <input
                type="text"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Ex: Verificar se as cores combinam com a paleta da Nisti Print e extrair ganchos para carrossel"
                className="w-full bg-surface-card border border-outline-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-pink-500/50"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isAnalyzing || !imagePreview}
              className="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50 shadow-sm shadow-pink-500/20"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Analisando Visão Computacional...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Auditar Ativo Criativo
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
            <p className="font-semibold">Aviso da Análise</p>
            <p className="opacity-90">{contextWarning}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-surface-elevated/40 border border-outline-border/70 rounded-2xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-border">
            <div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-md">
                Status: {result.epistemicStatus}
              </span>
              <h3 className="text-lg font-bold text-text-primary mt-1.5">{result.assetTitle}</h3>
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
                {savedPath ? "Salvo no Vault!" : "Salvar Análise no Vault"}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-surface-card border border-outline-border">
              <span className="text-xs font-bold text-pink-400 block mb-1.5">
                👁️ Resumo Visual & Composição
              </span>
              <p className="text-xs text-text-primary leading-relaxed">{result.visualSummary}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-surface-card border border-outline-border space-y-2">
                <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-pink-400" /> Elementos Detectados
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {result.detectedElements.map((el, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] px-2 py-0.5 rounded bg-surface-elevated border border-outline-border text-text-secondary"
                    >
                      {el}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface-card border border-outline-border space-y-2">
                <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> Canais Recomendados
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {result.recommendedChannels.map((ch, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] px-2 py-0.5 rounded bg-surface-elevated border border-outline-border text-text-secondary"
                    >
                      {ch}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-card border border-outline-border space-y-2">
              <span className="text-xs font-bold text-text-primary block">
                🎣 Ganchos Sugeridos para Produção
              </span>
              <ul className="space-y-1.5">
                {result.potentialHooks.map((hk, idx) => (
                  <li key={idx} className="text-xs text-text-secondary flex items-start gap-2">
                    <span className="text-pink-400 font-bold">•</span>
                    <span>"{hk}"</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-surface-card border border-outline-border space-y-2">
              <span className="text-xs font-bold text-text-primary block">
                💡 Ângulos e Abordagens Estratégicas
              </span>
              <ul className="space-y-1.5">
                {result.suggestedAngles.map((ang, idx) => (
                  <li key={idx} className="text-xs text-text-secondary flex items-start gap-2">
                    <span className="text-pink-400 font-bold">•</span>
                    <span>{ang}</span>
                  </li>
                ))}
              </ul>
            </div>

            {result.hypotheses?.length > 0 && (
              <div className="p-4 rounded-xl bg-surface-card/60 border border-outline-border/60">
                <span className="text-xs font-bold text-text-secondary block mb-1">
                  🧪 Hipóteses Formuladas
                </span>
                <ul className="space-y-1">
                  {result.hypotheses.map((h, idx) => (
                    <li key={idx} className="text-xs text-text-secondary/80">
                      - {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
