import fs from "node:fs";

function replaceOne(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`);
  return source.replace(before, after);
}

function patch(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`${path}: no changes`);
  fs.writeFileSync(path, after);
}

patch("src/services/api.ts", (source) => {
  source = replaceOne(
    source,
    `          confidence: classification.confidence,\n          suggestion: classification.folder,`,
    `          confidence,\n          suggestion: destinationFolder,`,
    "triage collision uses current classification",
  );
  source = replaceOne(
    source,
    `    const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);\n    if (!match) throw new Error("O arquivo binário não está em um Data URL válido.");`,
    `    const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);\n    if (!match) throw new Error("O arquivo binário não está em um Data URL válido.");\n    const allowedMime = /^(application\\/pdf|image\\/(png|jpeg|webp)|audio\\/(mpeg|mp3|wav|x-wav|mp4|aac|ogg|webm))$/i;\n    if (!allowedMime.test(match[1])) throw new Error("Tipo binário não autorizado para persistência no Vault.");`,
    "client binary MIME allowlist",
  );
  return source;
});

patch("server.ts", (source) => {
  source = replaceOne(
    source,
    `    if (binaryPayload) forwardHeaders["Content-Type"] = binaryPayload.mimeType;`,
    `    if (binaryPayload) {\n      const allowedBinaryMime = /^(application\\/pdf|image\\/(png|jpeg|webp)|audio\\/(mpeg|mp3|wav|x-wav|mp4|aac|ogg|webm))$/i;\n      if (!allowedBinaryMime.test(binaryPayload.mimeType)) {\n        return res.status(400).json({ success: false, error: "Tipo binário não autorizado para o proxy do Obsidian." });\n      }\n      if (Buffer.byteLength(binaryPayload.__nistiBinaryBase64, "base64") > 20 * 1024 * 1024) {\n        return res.status(413).json({ success: false, error: "Asset binário excede o limite de 20 MB." });\n      }\n      forwardHeaders["Content-Type"] = binaryPayload.mimeType;\n    }`,
    "server binary MIME allowlist",
  );

  source = replaceOne(
    source,
    `      const fallback = () => safePdfData(fileName, extractedText);`,
    `      const fallback = () => applyObservedSocialMetrics(safePdfData(fileName, extractedText), extractedText);`,
    "PDF observed metrics fallback",
  );
  source = replaceOne(
    source,
    `      return sendAISuccess(req, res, result);\n    }\n\n    if (type === "site") {`,
    `      return sendAISuccess(req, res, { ...result, data: applyObservedSocialMetrics(result.data as Record<string, any>, cleanText) });\n    }\n\n    if (type === "site") {`,
    "PDF observed metrics AI",
  );
  source = replaceOne(
    source,
    `      const fallback = () => safeSiteData(siteUrl, pageTitle, pageContent);`,
    `      const fallback = () => applyObservedSocialMetrics(safeSiteData(siteUrl, pageTitle, pageContent), pageContent);`,
    "site observed metrics fallback",
  );
  source = replaceOne(
    source,
    `      return sendAISuccess(req, res, result);\n    }\n\n    if (type === "image") {`,
    `      return sendAISuccess(req, res, { ...result, data: applyObservedSocialMetrics(result.data as Record<string, any>, pageContent) });\n    }\n\n    if (type === "image") {`,
    "site observed metrics AI",
  );
  source = replaceOne(
    source,
    `      return sendAISuccess(req, res, result);\n    }\n\n    if (type === "text") {`,
    `      return sendAISuccess(req, res, { ...result, data: applyObservedSocialMetrics(result.data as Record<string, any>, JSON.stringify(result.data)) });\n    }\n\n    if (type === "text") {`,
    "image observed metrics AI",
  );

  const oldLearningFallback = `    const fallback = () => {\n      const confirmedCount = Array.isArray(existingLearnings)\n        ? existingLearnings.filter((l: any) => l.verdict === "CONFIRMADO").length\n        : 0;\n      return {\n        executiveSummary: \`Análise consolidada baseada em \${Array.isArray(postHistory) ? postHistory.length : 0} publicações e \${Array.isArray(existingLearnings) ? existingLearnings.length : 0} aprendizados registrados.\`,\n        strengthsAndWins: [\n          "Formatos com métricas completas de conversão demonstram previsibilidade superior.",\n          "Canais ativos mantêm consistência na entrega de resultados de alcance.",\n        ],\n        weaknessesAndRisks: [\n          "Necessidade de reforçar o registro sistemático de CTR e taxa de conversão em todos os canais.",\n        ],\n        validatedRules: [\n          {\n            title: "Consistência de formato e proposta de valor",\n            category: "formato",\n            verdict: "EM_TESTE",\n            ruleOfThumb: "Mantenha a frequência semanal nos formatos com medições ativas.",\n            evidenceData: \`\${postHistory.length} publicações registradas no histórico recente (requer validação contínua de conversão).\`,\n            suggestedAction: "Incorporar hipótese no briefing e monitorar taxa de conversão.",\n          }\n        ],\n        hypothesesToTest: [\n          "Carrosséis educativos com estudo de caso superam posts estáticos em taxa de cliques.",\n          "Publicações com chamada para ação direta no início geram mais conversões no direct/WhatsApp."\n        ],\n        nextCyclePriorities: [\n          "Priorizar canais com maior retorno comprovado em conversão.",\n          "Validar hipóteses pendentes com testes A/B estruturados."\n        ],\n        epistemicStatus: "HIPÓTESE"\n      };\n    };`;
  const newLearningFallback = `    const fallback = () => {\n      const publications = Array.isArray(postHistory) ? postHistory.length : 0;\n      const registeredLearnings = Array.isArray(existingLearnings) ? existingLearnings.length : 0;\n      return {\n        executiveSummary: \`Há \${publications} publicação(ões) e \${registeredLearnings} aprendizado(s) registrados. A síntese automática não está disponível; nenhum padrão de performance foi inferido localmente.\`,\n        strengthsAndWins: [],\n        weaknessesAndRisks: [],\n        validatedRules: [],\n        hypothesesToTest: [],\n        nextCyclePriorities: [],\n        epistemicStatus: "PENDENTE"\n      };\n    };`;
  source = replaceOne(source, oldLearningFallback, newLearningFallback, "grounded learning fallback");
  return source;
});

patch("electron-main.ts", (source) => {
  source = replaceOne(
    source,
    'const PERSISTABLE_SOURCE_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp"]);',
    'const PERSISTABLE_SOURCE_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".webm"]);',
    "physical audio extension allowlist",
  );
  source = replaceOne(
    source,
    '    throw new Error("Somente PDF, PNG, JPG/JPEG e WEBP podem ser preservados como fonte binária nesta etapa.");',
    '    throw new Error("Somente PDF, PNG, JPG/JPEG, WEBP, MP3, WAV, M4A, AAC, OGG e WEBM podem ser preservados como fonte binária.");',
    "physical asset error copy",
  );
  source = replaceOne(
    source,
    `    ".webp": ["image/webp"],\n  };`,
    `    ".webp": ["image/webp"],\n    ".mp3": ["audio/mpeg", "audio/mp3"],\n    ".wav": ["audio/wav", "audio/x-wav"],\n    ".m4a": ["audio/mp4"],\n    ".aac": ["audio/aac"],\n    ".ogg": ["audio/ogg"],\n    ".webm": ["audio/webm"],\n  };`,
    "physical audio MIME map",
  );
  source = replaceOne(
    source,
    'function assetKindForExtension(extension: string): "pdf" | "image" {\n  return extension === ".pdf" ? "pdf" : "image";\n}',
    'function assetKindForExtension(extension: string): "pdf" | "image" | "audio" {\n  if (extension === ".pdf") return "pdf";\n  return [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".webm"].includes(extension) ? "audio" : "image";\n}',
    "physical audio asset kind",
  );
  source = replaceOne(source, '      kind: "pdf" | "image";', '      kind: "pdf" | "image" | "audio";', "physical asset metadata kind");
  return source;
});

patch("src/utils/dashboardIntelligence.ts", (source) => {
  source = replaceOne(
    source,
    'import { assessBaseReadiness } from "../domain/baseOnboarding";',
    'import { assessSmartKnowledgeReadiness } from "../domain/smartKnowledgeStage2";',
    "dashboard smart readiness import",
  );

  const oldDetail = `function baseReadinessDetail(notes: ObsidianNote[]): string {\n  const readiness = assessBaseReadiness(notes);\n  const missing = readiness.missingSectionIds.length;\n  const pending = readiness.pendingPaths.length;\n  const parts: string[] = [];\n\n  if (missing > 0) {\n    parts.push(\`\${missing} \${missing === 1 ? "documento canônico ainda não existe" : "documentos canônicos ainda não existem"}\`);\n  }\n  if (pending > 0) {\n    parts.push(\`\${pending} \${pending === 1 ? "documento precisa de revisão" : "documentos precisam de revisão"}\`);\n  }\n\n  return parts.length > 0\n    ? \`\${parts.join(" e ")}. Complete ou revise a Base antes de depender dela para decisões de marketing.\`\n    : "A Base Inicial está pronta.";\n}`;
  const newDetail = `function baseReadinessDetail(notes: ObsidianNote[]): string {\n  const readiness = assessSmartKnowledgeReadiness(notes);\n  if (readiness.ready) {\n    return \`Conhecimento operacional pronto com \${readiness.strategicSources} fonte(s) estratégica(s) utilizável(is).\`;\n  }\n  if (readiness.pendingSources > 0) {\n    return \`Há \${readiness.pendingSources} fonte(s) pendente(s) e nenhuma evidência estratégica utilizável. Revise a Inbox ou as fontes em validação antes de planejar.\`;\n  }\n  return "Adicione ao menos uma fonte real em Estratégia, Produtos, Conteúdos, Pesquisas ou Aprendizados antes de depender da IA para planejamento.";\n}`;
  source = replaceOne(source, oldDetail, newDetail, "dashboard readiness detail");

  source = replaceOne(
    source,
    `  const readiness = assessBaseReadiness(notes);\n  if (!readiness.complete) {\n    return [\n      {\n        id: "base-not-ready",\n        title: readiness.missingSectionIds.length > 0 ? "Base Inicial incompleta" : "Base Inicial precisa de revisão",\n        detail: baseReadinessDetail(notes),\n        destination: "base",\n      },\n    ];\n  }`,
    `  const readiness = assessSmartKnowledgeReadiness(notes);\n  if (!readiness.ready) {\n    return [\n      {\n        id: "base-not-ready",\n        title: readiness.pendingSources > 0 ? "Conhecimento precisa de revisão" : "Conhecimento estratégico ausente",\n        detail: baseReadinessDetail(notes),\n        destination: "base",\n      },\n    ];\n  }`,
    "dashboard blocker smart readiness",
  );

  source = replaceOne(
    source,
    '        "O Nisti só usa o conhecimento depois que a conexão e a pasta física do Vault são validadas."',
    '        "O Nisti só usa o conhecimento depois que a conexão REST com o Vault ativo é validada."',
    "dashboard REST copy",
  );

  const oldPriority = `  const readiness = assessBaseReadiness(notes);\n  if (!readiness.complete) {\n    if (readiness.missingSectionIds.length > 0) {\n      return {\n        id: "complete-base",\n        kind: "complete-base",\n        title: "Complete a Base Inicial antes de planejar",\n        subtitle: baseReadinessDetail(notes),\n        badgeLabel: "Base incompleta",\n        tone: "info",\n      };\n    }\n\n    return {\n      id: "review-base",\n      kind: "review-base",\n      title: "Revise as pendências da Base Inicial",\n      subtitle: baseReadinessDetail(notes),\n      badgeLabel: "Base em revisão",\n      tone: "high",\n    };\n  }`;
  const newPriority = `  const readiness = assessSmartKnowledgeReadiness(notes);\n  if (!readiness.ready) {\n    if (readiness.pendingSources > 0) {\n      return {\n        id: "review-base",\n        kind: "review-base",\n        title: "Revise o conhecimento pendente antes de planejar",\n        subtitle: baseReadinessDetail(notes),\n        badgeLabel: "Conhecimento em revisão",\n        tone: "high",\n      };\n    }\n\n    return {\n      id: "complete-base",\n      kind: "complete-base",\n      title: "Adicione conhecimento real antes de planejar",\n      subtitle: baseReadinessDetail(notes),\n      badgeLabel: "Conhecimento ausente",\n      tone: "info",\n    };\n  }`;
  source = replaceOne(source, oldPriority, newPriority, "dashboard priority smart readiness");
  return source;
});

console.log("Stage 2 hardening fixes applied.");
