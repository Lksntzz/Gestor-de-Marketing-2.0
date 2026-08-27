import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import * as pdfParseModule from "pdf-parse";

dotenv.config();

async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const parseFn: any = (pdfParseModule as any).default || pdfParseModule;
    const parsed = typeof parseFn === "function" ? await parseFn(buffer) : { text: "" };
    return parsed.text || "";
  } catch (err) {
    console.warn("PDF parsing notice:", err);
    return "";
  }
}

const app = express();
const PORT = 3000;
const SERVER_SESSION_SECRET = process.env.API_SESSION_SECRET || crypto.randomBytes(32).toString("hex");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
app.use("/api/", (req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60_000 });
  } else {
    entry.count += 1;
    if (entry.count > 120) {
      return res.status(429).json({ success: false, error: "Limite de requisições excedido. Tente novamente em 1 minuto." });
    }
  }
  next();
});

app.get("/api/auth/session", (_req, res) => {
  res.json({ success: true, token: SERVER_SESSION_SECRET });
});

app.use("/api/gemini/", (req, res, next) => {
  const bearer = req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
  const clientToken = String(req.headers["x-app-session-token"] || bearer || "");
  if (clientToken === SERVER_SESSION_SECRET || process.env.NODE_ENV !== "production") {
    return next();
  }
  return res.status(401).json({ success: false, error: "Acesso não autorizado ao backend da API." });
});

app.use(express.json({ limit: "25mb" }));

function isSafePublicUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (parsed.port && parsed.port !== "80" && parsed.port !== "443") return false;

    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("169.254.") ||
      hostname.startsWith("224.") ||
      hostname === "metadata.google.internal" ||
      hostname === "metadata" ||
      hostname.includes("instance-data")
    ) {
      return false;
    }

    const match172 = hostname.match(/^172\.(\d+)\./);
    if (match172) {
      const secondOctet = Number(match172[1]);
      if (secondOctet >= 16 && secondOctet <= 31) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function fetchSafeWebPage(targetUrl: string, maxRedirects = 3): Promise<{ title: string; text: string }> {
  let currentUrl = targetUrl;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    if (!isSafePublicUrl(currentUrl)) {
      throw new Error("URL inválida ou direcionada para rede privada/bloqueada.");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        headers: { "User-Agent": "Nisti-Marketing/2.0" },
        redirect: "manual",
        signal: controller.signal,
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Redirecionamento sem destino.");
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch?.[1]?.trim() || "Artigo da Web";
      const text = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 12_000);
      return { title, text };
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw new Error("Número máximo de redirecionamentos excedido.");
}

function createGeminiClient(customApiKey?: string): GoogleGenAI {
  const apiKey = customApiKey?.trim();
  if (!apiKey) throw new Error("Chave de API do Gemini não configurada.");
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "nisti-marketing-2.0" } },
  });
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
    runtime: "web_server_backend",
  });
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const GEMINI_TEXT_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.7-flash",
  "gemini-3.1-pro-preview",
];

function sanitizeOfficialFolder(title: string, category: string, bodyText: string): string {
  const text = `${title} ${category} ${bodyText}`.toLowerCase();
  if (/estrat[eé]gia|branding|posicionamento|miss[aã]o|persona|avatar/.test(text)) return "01_Estrategia";
  if (/produto|pricing|pre[cç]o|cat[aá]logo|impress[aã]o|brinde/.test(text)) return "02_Produtos";
  if (/copywriting|copy|post|roteiro|artigo|headline|carrossel/.test(text)) return "03_Conteudos";
  if (/campanha|lan[cç]amento|meta ads|tr[aá]fego pago|cronograma/.test(text)) return "04_Campanhas";
  if (/reuni[aã]o|ata|alinhamento|briefing/.test(text)) return "05_Reunioes";
  if (/influenciador|ugc|parceria|afiliado/.test(text)) return "06_Influenciadores_UGC";
  if (/pesquisa|benchmark|concorrente|estudo de mercado/.test(text)) return "07_Pesquisas";
  if (/aprendizado|relat[oó]rio|m[eé]trica|post-mortem|p[oó]s-campanha/.test(text)) return "08_Aprendizados";
  if (/template|modelo|estrutura padr[aã]o/.test(text)) return "99_Templates";
  return "00_Inbox";
}

function yamlSafe(value: unknown): string {
  return String(value ?? "").replace(/[\r\n]+/g, " ").replace(/"/g, "'").trim();
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function sourceFrontmatter(params: {
  id: string;
  type: string;
  status?: string;
  epistemicStatus?: string;
  category?: string;
  source?: string;
  tags?: string[];
}): string {
  const tags = params.tags || [];
  return [
    "---",
    `id: "${yamlSafe(params.id)}"`,
    `tipo: "${yamlSafe(params.type)}"`,
    `status: "${yamlSafe(params.status || "NOVO")}"`,
    `epistemic_status: "${yamlSafe(params.epistemicStatus || "PENDENTE")}"`,
    `category: "${yamlSafe(params.category || "Não classificado")}"`,
    'owner: "Nisti Marketing"',
    `created_at: "${todayKey()}"`,
    `updated_at: "${todayKey()}"`,
    "tags:",
    ...(tags.length ? tags.map((tag) => `  - "${yamlSafe(tag)}"`) : ["  - conhecimento"]),
    `origem: "${yamlSafe(params.source || "Entrada manual")}"`,
    'approved_by: ""',
    "---",
  ].join("\n");
}

async function executeGeminiWithFallback<T>(
  buildParams: (model: string) => any,
  safeFallback: () => T,
  customApiKey?: string
): Promise<{ data: T; usedModel: string; wasFallback: boolean }> {
  const ai = createGeminiClient(customApiKey);
  for (const model of GEMINI_TEXT_MODELS) {
    try {
      const response = await ai.models.generateContent(buildParams(model));
      const text = response.text || "{}";
      return { data: JSON.parse(text) as T, usedModel: model, wasFallback: false };
    } catch (err) {
      console.warn(`Gemini model ${model} failed:`, err);
      await wait(250);
    }
  }
  return { data: safeFallback(), usedModel: "grounded-safe-fallback", wasFallback: true };
}

function groundedCampaignFallback(input: {
  name: string;
  objective: string;
  channels: string[];
  audience?: string;
  tone?: string;
}) {
  const { name, objective, channels, audience, tone } = input;
  const today = todayKey();
  const contextLines = [
    `- **Objetivo informado**: ${objective}`,
    audience ? `- **Público informado**: ${audience}` : "- **Público**: PENDENTE",
    tone ? `- **Tom informado**: ${tone}` : "- **Tom**: PENDENTE",
    `- **Canais informados**: ${channels.join(", ")}`,
  ];

  return {
    summary: `Plano provisório para "${name}" baseado somente nos dados informados pelo usuário.`,
    strategy: "Antes de publicar, validar no Vault preços, prazos, diferenciais, métricas, produtos, disponibilidade e qualquer outra promessa comercial.",
    channelsContent: channels.map((channel) => ({
      channel,
      title: `${name} — rascunho para ${channel}`,
      copy: `Comunicar o objetivo "${objective}" usando apenas fatos CONFIRMADOS na base de conhecimento. Itens sem evidência devem permanecer como HIPÓTESE ou PENDENTE.`,
      callToAction: "PENDENTE — definir CTA após validação do objetivo e da oferta.",
      hashtagsOrKeywords: [],
      suggestedPublishDate: "",
    })),
    tasks: [
      {
        title: `Validar fatos e promessas da campanha ${name}`,
        channel: "Interno",
        priority: "high",
        dueDate: "",
        obsidianTaskString: `- [ ] Validar fatos e promessas da campanha ${name} #revisao #pendente`,
      },
    ],
    suggestedReminders: [],
    obsidianNoteMarkdown: `${sourceFrontmatter({
      id: `camp_${Date.now().toString(36)}`,
      type: "Plano de Campanha",
      status: "EM REVISÃO",
      epistemicStatus: "PENDENTE",
      category: "Campanha",
      source: "Briefing informado no Nisti Marketing",
      tags: ["campanha", "revisao"],
    })}\n\n# Plano de Campanha: ${name}\n\n${contextLines.join("\n")}\n\n## Regra de evidência\nNão publicar nenhuma afirmação comercial que não esteja CONFIRMADA no Vault.\n\n_Registro criado em ${today}._`,
  };
}

app.post("/api/gemini/generate-campaign", async (req, res) => {
  try {
    const { campaignName, objective, channels, audience, tone, contextNotes, customInstructions, engineMode } = req.body || {};
    const name = String(campaignName || "").trim();
    const goal = String(objective || "").trim();
    const channelList = Array.isArray(channels) ? channels.map(String).map((item) => item.trim()).filter(Boolean) : [];
    if (!name || !goal || channelList.length === 0) {
      return res.status(400).json({ success: false, error: "Campanha, objetivo e ao menos um canal são obrigatórios." });
    }

    const safeFallback = () => groundedCampaignFallback({
      name,
      objective: goal,
      channels: channelList,
      audience: String(audience || "").trim() || undefined,
      tone: String(tone || "").trim() || undefined,
    });

    if (engineMode === "local") {
      return res.json({ success: true, data: safeFallback(), usedModel: "local-grounded-engine", wasFallback: false });
    }

    const prompt = `Você é o copiloto de marketing do Nisti Marketing. Crie um plano de campanha usando SOMENTE os dados do briefing e os fatos presentes no contexto do Vault.

REGRAS EPISTÊMICAS OBRIGATÓRIAS:
- Não invente preços, prazos, quantidades mínimas, margens, métricas, diferenciais, materiais, estoque, garantias, clientes ou resultados.
- Informação presente no contexto pode ser tratada como CONFIRMADA apenas quando a própria nota indicar isso.
- Informação não comprovada deve ser marcada como HIPÓTESE ou PENDENTE.
- O plano deve sair em status EM REVISÃO, nunca OFICIAL automaticamente.

BRIEFING:
Campanha: ${name}
Objetivo: ${goal}
Canais: ${channelList.join(", ")}
Público informado: ${String(audience || "PENDENTE")}
Tom informado: ${String(tone || "PENDENTE")}
Instruções adicionais: ${String(customInstructions || "Nenhuma")}

CONTEXTO DO VAULT:
${String(contextNotes || "Nenhum contexto fornecido.")}

Retorne JSON com summary, strategy, channelsContent, tasks, suggestedReminders e obsidianNoteMarkdown.`;

    const schemaConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          strategy: { type: Type.STRING },
          channelsContent: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                channel: { type: Type.STRING },
                title: { type: Type.STRING },
                copy: { type: Type.STRING },
                callToAction: { type: Type.STRING },
                hashtagsOrKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                suggestedPublishDate: { type: Type.STRING },
              },
              required: ["channel", "title", "copy", "callToAction"],
            },
          },
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                channel: { type: Type.STRING },
                priority: { type: Type.STRING },
                dueDate: { type: Type.STRING },
                obsidianTaskString: { type: Type.STRING },
              },
              required: ["title", "priority", "obsidianTaskString"],
            },
          },
          suggestedReminders: { type: Type.ARRAY, items: { type: Type.OBJECT } },
          obsidianNoteMarkdown: { type: Type.STRING },
        },
        required: ["summary", "strategy", "channelsContent", "tasks", "suggestedReminders", "obsidianNoteMarkdown"],
      },
    };

    const customApiKey = req.headers["x-gemini-api-key"] as string | undefined;
    const result = await executeGeminiWithFallback(
      (model) => ({ model, contents: prompt, config: schemaConfig }),
      safeFallback,
      customApiKey
    );
    return res.json({ success: true, data: result.data, usedModel: result.usedModel, wasFallback: result.wasFallback });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Erro na geração da campanha" });
  }
});

app.post("/api/gemini/generate-guidelines", async (req, res) => {
  try {
    const { campaignName, objective, engineMode } = req.body || {};
    const name = String(campaignName || "").trim();
    const goal = String(objective || "").trim();
    if (!name || !goal) return res.status(400).json({ success: false, error: "Campanha e objetivo são obrigatórios." });

    const safeFallback = () => ({
      guidelines: `Para a campanha "${name}", mantenha o foco no objetivo informado: "${goal}". Antes de definir promessas, diferenciais ou métricas, valide cada afirmação no Vault. Use apenas fatos CONFIRMADOS; trate o restante como HIPÓTESE ou PENDENTE.`,
    });

    if (engineMode === "local") {
      return res.json({ success: true, data: safeFallback(), usedModel: "local-grounded-engine", wasFallback: false });
    }

    const prompt = `Gere diretrizes estratégicas concisas para a campanha abaixo.
Campanha: ${name}
Objetivo: ${goal}
Não invente fatos comerciais. Se uma decisão depender de dados ausentes, marque como PENDENTE. Retorne JSON com a propriedade guidelines.`;
    const schemaConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: { guidelines: { type: Type.STRING } },
        required: ["guidelines"],
      },
    };
    const customApiKey = req.headers["x-gemini-api-key"] as string | undefined;
    const result = await executeGeminiWithFallback(
      (model) => ({ model, contents: prompt, config: schemaConfig }),
      safeFallback,
      customApiKey
    );
    return res.json({ success: true, data: result.data, usedModel: result.usedModel, wasFallback: result.wasFallback });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Erro na geração das diretrizes" });
  }
});

function extractExplicitTasks(noteContent: string) {
  const lines = String(noteContent || "").split(/\r?\n/);
  const tasks = lines
    .filter((line) => /^\s*[-*]\s+\[\s\]\s+/.test(line))
    .slice(0, 50)
    .map((line, index) => {
      const taskText = line.replace(/^\s*[-*]\s+\[\s\]\s+/, "").trim();
      const dueDate = taskText.match(/📅\s*(\d{4}-\d{2}-\d{2})/)?.[1] || "";
      const dueTime = taskText.match(/⏰\s*(\d{2}:\d{2})/)?.[1] || "";
      const title = taskText.replace(/📅\s*\d{4}-\d{2}-\d{2}/g, "").replace(/⏰\s*\d{2}:\d{2}/g, "").trim();
      return {
        title: title || `Tarefa ${index + 1}`,
        channel: "",
        priority: "medium",
        dueDate,
        dueTime,
        obsidianTaskString: line.trim(),
        reminderDate: "",
        reminderTime: "",
        category: "Extraída da fonte",
      };
    });
  return {
    extractedTasks: tasks,
    suggestedReminders: [],
    summaryInsights: `${tasks.length} tarefa(s) explícita(s) encontrada(s) na nota. Nenhuma tarefa nova foi inventada.`,
  };
}

app.post("/api/gemini/extract-tasks", async (req, res) => {
  try {
    const { noteContent, noteTitle, engineMode } = req.body || {};
    const content = String(noteContent || "");
    const title = String(noteTitle || "Sem título");
    const safeFallback = () => extractExplicitTasks(content);

    if (engineMode === "local") {
      return res.json({ success: true, data: safeFallback(), usedModel: "local-explicit-task-parser", wasFallback: false });
    }

    const prompt = `Extraia SOMENTE tarefas explicitamente presentes na nota abaixo. Não crie novas tarefas, datas, horários, prioridades, lembretes ou canais que não estejam escritos na fonte.
TÍTULO: ${title}
CONTEÚDO:
${content}

Retorne JSON com extractedTasks, suggestedReminders e summaryInsights. Se não houver tarefas explícitas, retorne listas vazias.`;
    const schemaConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          extractedTasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                channel: { type: Type.STRING },
                priority: { type: Type.STRING },
                dueDate: { type: Type.STRING },
                dueTime: { type: Type.STRING },
                obsidianTaskString: { type: Type.STRING },
                reminderDate: { type: Type.STRING },
                reminderTime: { type: Type.STRING },
                category: { type: Type.STRING },
              },
              required: ["title", "obsidianTaskString"],
            },
          },
          suggestedReminders: { type: Type.ARRAY, items: { type: Type.OBJECT } },
          summaryInsights: { type: Type.STRING },
        },
        required: ["extractedTasks", "suggestedReminders", "summaryInsights"],
      },
    };
    const customApiKey = req.headers["x-gemini-api-key"] as string | undefined;
    const result = await executeGeminiWithFallback(
      (model) => ({ model, contents: prompt, config: schemaConfig }),
      safeFallback,
      customApiKey
    );
    return res.json({ success: true, data: result.data, usedModel: result.usedModel, wasFallback: result.wasFallback });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Erro na extração de tarefas" });
  }
});

function safePdfData(fileName: string, extractedText: string) {
  const cleanTitle = yamlSafe(fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ")) || "Documento PDF";
  const text = extractedText.trim().slice(0, 10_000);
  const folder = sanitizeOfficialFolder(cleanTitle, "PDF", text);
  const hasText = text.length > 0;
  return {
    title: cleanTitle,
    summary: hasText
      ? `Texto extraído do PDF para revisão humana (${text.length} caracteres indexados).`
      : "PDF registrado, mas nenhum texto indexável foi extraído. O conteúdo permanece PENDENTE.",
    category: "Documento PDF",
    keywords: ["pdf"],
    wikilinks: [],
    evidence: hasText ? ["Existe texto extraído diretamente do arquivo PDF."] : [],
    hypotheses: [],
    epistemic_status: hasText ? "CONFIRMADO" : "PENDENTE",
    folder,
    content: `${sourceFrontmatter({
      id: `pdf_${Date.now().toString(36)}`,
      type: "Documento PDF",
      epistemicStatus: hasText ? "CONFIRMADO" : "PENDENTE",
      category: "Documento PDF",
      source: fileName,
      tags: ["pdf"],
    })}\n\n# ${cleanTitle}\n\n## Conteúdo extraído\n${text || "Nenhum texto indexável extraído. Revisão manual necessária."}`,
  };
}

function safeSiteData(siteUrl: string, pageTitle: string, pageContent: string) {
  const title = yamlSafe(pageTitle) || "Artigo da Web";
  const text = pageContent.trim().slice(0, 10_000);
  const folder = sanitizeOfficialFolder(title, "Artigo", text);
  const hasText = text.length > 0;
  return {
    title,
    summary: hasText
      ? `Conteúdo textual extraído da URL para revisão (${text.length} caracteres indexados).`
      : "URL registrada sem conteúdo textual validado. A fonte permanece PENDENTE.",
    category: "Artigo Web",
    keywords: ["web"],
    wikilinks: [],
    evidence: hasText ? ["Texto obtido diretamente da página informada."] : [],
    hypotheses: [],
    epistemic_status: hasText ? "CONFIRMADO" : "PENDENTE",
    folder,
    content: `${sourceFrontmatter({
      id: `site_${Date.now().toString(36)}`,
      type: "Artigo Web",
      epistemicStatus: hasText ? "CONFIRMADO" : "PENDENTE",
      category: "Artigo Web",
      source: siteUrl,
      tags: ["web"],
    })}\n\n# ${title}\n\n- **URL**: ${siteUrl}\n\n## Conteúdo capturado\n${text || "Conteúdo não extraído. Revisão manual necessária."}`,
  };
}

function safeTextData(titleInput: string, rawText: string) {
  const title = yamlSafe(titleInput) || "Captura de Texto";
  const text = String(rawText || "").trim();
  const folder = sanitizeOfficialFolder(title, "Texto", text);
  return {
    title,
    summary: "Texto fornecido diretamente pelo usuário e preservado para curadoria.",
    category: "Texto",
    tags: ["texto"],
    keywords: ["texto"],
    wikilinks: [],
    evidence: text ? ["Conteúdo fornecido diretamente pelo usuário."] : [],
    hypotheses: [],
    epistemic_status: text ? "CONFIRMADO" : "PENDENTE",
    folder,
    content: `${sourceFrontmatter({
      id: `text_${Date.now().toString(36)}`,
      type: "Texto",
      epistemicStatus: text ? "CONFIRMADO" : "PENDENTE",
      category: "Texto",
      source: "Entrada manual",
      tags: ["texto"],
    })}\n\n# ${title}\n\n${text || "Conteúdo vazio."}`,
  };
}

function safeYouTubeMetadataData(payload: any, metadata?: { title?: string; author?: string }) {
  const url = String(payload?.url || "").trim();
  const providedTitle = String(payload?.videoTitle || payload?.title || "").trim();
  const providedChannel = String(payload?.videoChannel || "").trim();
  const title = yamlSafe(metadata?.title || providedTitle || "Referência do YouTube");
  const author = yamlSafe(metadata?.author || providedChannel || "");
  const evidence = [
    url ? `URL informada: ${url}` : "",
    metadata?.title ? `Título obtido via oEmbed: ${metadata.title}` : providedTitle ? `Título informado pelo usuário: ${providedTitle}` : "",
    metadata?.author ? `Canal obtido via oEmbed: ${metadata.author}` : providedChannel ? `Canal informado pelo usuário: ${providedChannel}` : "",
  ].filter(Boolean);

  return {
    title: `YouTube - ${title}`,
    summary: "Apenas metadados da referência foram capturados. O conteúdo audiovisual/transcrição não foi analisado, portanto qualquer insight sobre o vídeo permanece PENDENTE.",
    category: "Referência YouTube",
    keywords: ["youtube"],
    wikilinks: [],
    evidence,
    hypotheses: [],
    keyTakeaways: [],
    suggestedAngles: [],
    epistemic_status: "PENDENTE",
    folder: "00_Inbox",
    content: `${sourceFrontmatter({
      id: `yt_${Date.now().toString(36)}`,
      type: "Referência YouTube",
      epistemicStatus: "PENDENTE",
      category: "Referência YouTube",
      source: url,
      tags: ["youtube", "metadados"],
    })}\n\n# YouTube - ${title}\n\n- **URL**: ${url || "PENDENTE"}\n- **Canal**: ${author || "PENDENTE"}\n\n## Limite da análise\nO Nisti capturou apenas metadados. Nenhuma afirmação sobre o conteúdo do vídeo deve ser tratada como confirmada sem transcrição ou texto-fonte.`,
  };
}

function safeImageData(titleInput: string) {
  const title = yamlSafe(titleInput) || "Imagem";
  return {
    title,
    summary: "Imagem registrada. Sem análise visual confirmada, o conteúdo permanece PENDENTE.",
    category: "Ativo Visual",
    keywords: ["imagem"],
    wikilinks: [],
    evidence: [],
    hypotheses: [],
    epistemic_status: "PENDENTE",
    folder: "00_Inbox",
    content: `${sourceFrontmatter({
      id: `image_${Date.now().toString(36)}`,
      type: "Ativo Visual",
      epistemicStatus: "PENDENTE",
      category: "Ativo Visual",
      source: "Imagem enviada ao Nisti Marketing",
      tags: ["imagem"],
    })}\n\n# ${title}\n\nAnálise visual não confirmada. Revisão humana necessária.`,
  };
}

app.post("/api/gemini/process-knowledge", async (req, res) => {
  try {
    const { type, payload, engineMode } = req.body || {};
    if (!type || !payload) {
      return res.status(400).json({ success: false, error: "Parâmetros inválidos. 'type' e 'payload' são obrigatórios." });
    }

    if (type === "youtube") {
      const ytUrl = String(payload.url || "").trim();
      if (!ytUrl) return res.status(400).json({ success: false, error: "URL do YouTube é obrigatória." });
      let metadata: { title?: string; author?: string } = {};
      if (engineMode !== "local") {
        try {
          const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(ytUrl)}&format=json`;
          const response = await fetch(oembedUrl, { signal: AbortSignal.timeout(4_000) });
          if (response.ok) {
            const data = await response.json();
            metadata = { title: data.title, author: data.author_name };
          }
        } catch (err) {
          console.warn("YouTube oEmbed metadata unavailable:", err);
        }
      }
      return res.json({
        success: true,
        data: safeYouTubeMetadataData(payload, metadata),
        usedModel: "metadata-only",
        wasFallback: false,
      });
    }

    if (type === "pdf") {
      const fileName = String(payload.fileName || "documento.pdf");
      let extractedText = String(payload.textContentSample || "");
      if (payload.base64) {
        try {
          const rawBase64 = String(payload.base64).replace(/^data:application\/pdf;base64,/, "");
          extractedText = await parsePdfBuffer(Buffer.from(rawBase64, "base64"));
        } catch (err) {
          console.warn("PDF extraction failed:", err);
        }
      }
      const fallback = () => safePdfData(fileName, extractedText);
      if (engineMode === "local") {
        return res.json({ success: true, data: fallback(), usedModel: "local-grounded-engine", wasFallback: false });
      }
      const cleanText = extractedText.trim().slice(0, 10_000);
      if (!cleanText) {
        return res.json({ success: true, data: fallback(), usedModel: "no-text", wasFallback: false });
      }
      const prompt = `Analise SOMENTE o texto extraído deste PDF. Não acrescente fatos externos e não invente dados.
Arquivo: ${fileName}
Texto extraído:
${cleanText}

Retorne title, summary, content, category, keywords, wikilinks, evidence, hypotheses, epistemic_status e folder. Evidências devem citar apenas informações presentes no texto. Hipóteses devem ser explicitamente rotuladas. Pastas válidas: 00_Inbox, 01_Estrategia, 02_Produtos, 03_Conteudos, 04_Campanhas, 05_Reunioes, 06_Influenciadores_UGC, 07_Pesquisas, 08_Aprendizados, 99_Templates.`;
      const schemaConfig = knowledgeSchema();
      const customApiKey = req.headers["x-gemini-api-key"] as string | undefined;
      const result = await executeGeminiWithFallback(
        (model) => ({ model, contents: prompt, config: schemaConfig }),
        fallback,
        customApiKey
      );
      return res.json({ success: true, data: result.data, usedModel: result.usedModel, wasFallback: result.wasFallback });
    }

    if (type === "site") {
      const siteUrl = String(payload.url || "").trim();
      if (!siteUrl) return res.status(400).json({ success: false, error: "URL do site é obrigatória." });
      let pageTitle = String(payload.pageTitle || payload.title || "Artigo da Web");
      let pageContent = String(payload.textContentSample || "");
      if (engineMode !== "local") {
        try {
          const fetched = await fetchSafeWebPage(siteUrl);
          pageTitle = fetched.title || pageTitle;
          pageContent = fetched.text || pageContent;
        } catch (err) {
          console.warn("Web content extraction unavailable:", err);
        }
      }
      const fallback = () => safeSiteData(siteUrl, pageTitle, pageContent);
      if (engineMode === "local" || !pageContent.trim()) {
        return res.json({ success: true, data: fallback(), usedModel: engineMode === "local" ? "local-grounded-engine" : "no-page-text", wasFallback: false });
      }
      const prompt = `Analise SOMENTE o conteúdo textual extraído da URL abaixo. Não invente fatos nem use conhecimento externo.
URL: ${siteUrl}
Título: ${pageTitle}
Conteúdo:
${pageContent.slice(0, 10_000)}

Retorne title, summary, content, category, keywords, wikilinks, evidence, hypotheses, epistemic_status e folder. Pastas válidas: 00_Inbox, 01_Estrategia, 02_Produtos, 03_Conteudos, 04_Campanhas, 05_Reunioes, 06_Influenciadores_UGC, 07_Pesquisas, 08_Aprendizados, 99_Templates.`;
      const customApiKey = req.headers["x-gemini-api-key"] as string | undefined;
      const result = await executeGeminiWithFallback(
        (model) => ({ model, contents: prompt, config: knowledgeSchema() }),
        fallback,
        customApiKey
      );
      return res.json({ success: true, data: result.data, usedModel: result.usedModel, wasFallback: result.wasFallback });
    }

    if (type === "image") {
      const title = String(payload.title || "Imagem");
      const fallback = () => safeImageData(title);
      const dataUri = String(payload.imageBase64 || "");
      if (engineMode === "local" || !dataUri) {
        return res.json({ success: true, data: fallback(), usedModel: "local-metadata-only", wasFallback: false });
      }
      const match = dataUri.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) return res.json({ success: true, data: fallback(), usedModel: "invalid-image-data", wasFallback: false });

      const prompt = `Analise apenas elementos VISÍVEIS nesta imagem. Não identifique marcas, materiais, qualidade, preço, contexto comercial, pessoas ou resultados além do que estiver objetivamente visível. Diferencie observações de hipóteses. Retorne title, summary, content, category, keywords, wikilinks, evidence, hypotheses, epistemic_status e folder.`;
      const customApiKey = req.headers["x-gemini-api-key"] as string | undefined;
      const result = await executeGeminiWithFallback(
        (model) => ({
          model,
          contents: [{
            role: "user",
            parts: [
              { text: `${prompt}\nTítulo informado pelo usuário: ${title}` },
              { inlineData: { mimeType: match[1], data: match[2] } },
            ],
          }],
          config: knowledgeSchema(),
        }),
        fallback,
        customApiKey
      );
      return res.json({ success: true, data: result.data, usedModel: result.usedModel, wasFallback: result.wasFallback });
    }

    if (type === "text") {
      const title = String(payload.title || "").trim();
      const rawText = String(payload.text || "").trim();
      if (!title || !rawText) return res.status(400).json({ success: false, error: "Título e texto são obrigatórios." });
      const fallback = () => safeTextData(title, rawText);
      if (engineMode === "local") {
        return res.json({ success: true, data: fallback(), usedModel: "local-grounded-engine", wasFallback: false });
      }
      const prompt = `Estruture SOMENTE o texto fornecido pelo usuário. Não acrescente fatos externos. Separe fatos explícitos de hipóteses e pendências.
Título: ${title}
Texto:
${rawText.slice(0, 12_000)}

Retorne title, summary, content, category, keywords, wikilinks, evidence, hypotheses, epistemic_status e folder.`;
      const customApiKey = req.headers["x-gemini-api-key"] as string | undefined;
      const result = await executeGeminiWithFallback(
        (model) => ({ model, contents: prompt, config: knowledgeSchema() }),
        fallback,
        customApiKey
      );
      return res.json({ success: true, data: result.data, usedModel: result.usedModel, wasFallback: result.wasFallback });
    }

    return res.status(400).json({ success: false, error: `Tipo de conhecimento não suportado: ${String(type)}` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Erro ao processar conhecimento" });
  }
});

function knowledgeSchema() {
  return {
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        summary: { type: Type.STRING },
        content: { type: Type.STRING },
        category: { type: Type.STRING },
        keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
        wikilinks: { type: Type.ARRAY, items: { type: Type.STRING } },
        evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
        hypotheses: { type: Type.ARRAY, items: { type: Type.STRING } },
        epistemic_status: { type: Type.STRING },
        folder: { type: Type.STRING },
      },
      required: ["title", "summary", "content", "category", "keywords", "wikilinks", "evidence", "hypotheses", "epistemic_status", "folder"],
    },
  };
}

function deterministicVaultAudit(vaultNotesOverview: unknown) {
  const notes = Array.isArray(vaultNotesOverview) ? vaultNotesOverview : [];
  if (notes.length === 0) {
    return {
      readinessScore: 0,
      scoreAnalysis: "Nenhuma nota foi fornecida para análise. A prontidão não pode ser inferida.",
      knowledgeGaps: [{ topic: "Base vazia", recommendation: "Conectar o Vault e indexar fontes reais antes de gerar recomendações.", urgency: "alta" }],
      suggestedCampaigns: [],
      automatedWorkflowRecommendations: [],
    };
  }

  let earned = 0;
  const max = notes.length * 4;
  let missingStatus = 0;
  let missingFolder = 0;
  for (const raw of notes) {
    const note = raw as any;
    if (note?.path) earned += 1;
    if (note?.title) earned += 1;
    if (note?.folder) earned += 1; else missingFolder += 1;
    if (note?.frontmatter?.status || note?.frontmatter?.epistemic_status) earned += 1; else missingStatus += 1;
  }
  const score = Math.round((earned / max) * 100);
  const gaps = [] as Array<{ topic: string; recommendation: string; urgency: string }>;
  if (missingStatus) gaps.push({ topic: "Status epistemológico ausente", recommendation: `Classificar ${missingStatus} nota(s) como CONFIRMADO, HIPÓTESE ou PENDENTE.`, urgency: "alta" });
  if (missingFolder) gaps.push({ topic: "Taxonomia incompleta", recommendation: `Classificar ${missingFolder} nota(s) em uma pasta do Vault.`, urgency: "media" });
  return {
    readinessScore: score,
    scoreAnalysis: `Heurística estrutural: ${earned} de ${max} campos mínimos preenchidos em ${notes.length} nota(s). O score não mede desempenho de marketing.`,
    knowledgeGaps: gaps,
    suggestedCampaigns: [],
    automatedWorkflowRecommendations: gaps.length ? ["Concluir a curadoria das pendências antes de gerar campanhas automáticas."] : [],
  };
}

app.post("/api/gemini/analyze-vault", async (req, res) => {
  try {
    const { vaultNotesOverview, engineMode } = req.body || {};
    const safeFallback = () => deterministicVaultAudit(vaultNotesOverview);
    if (engineMode === "local") {
      return res.json({ success: true, data: safeFallback(), usedModel: "local-structural-audit", wasFallback: false });
    }

    const prompt = `Analise SOMENTE os metadados do Vault abaixo. Não invente métricas, campanhas, personas, resultados ou fatos que não estejam presentes. Recomendações devem citar a lacuna observável que as justifica. Se a base estiver vazia, não sugira campanhas.
${JSON.stringify(vaultNotesOverview || [], null, 2)}`;
    const schemaConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          readinessScore: { type: Type.NUMBER },
          scoreAnalysis: { type: Type.STRING },
          knowledgeGaps: { type: Type.ARRAY, items: { type: Type.OBJECT } },
          suggestedCampaigns: { type: Type.ARRAY, items: { type: Type.OBJECT } },
          automatedWorkflowRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["readinessScore", "scoreAnalysis", "knowledgeGaps", "suggestedCampaigns", "automatedWorkflowRecommendations"],
      },
    };
    const customApiKey = req.headers["x-gemini-api-key"] as string | undefined;
    const result = await executeGeminiWithFallback(
      (model) => ({ model, contents: prompt, config: schemaConfig }),
      safeFallback,
      customApiKey
    );
    return res.json({ success: true, data: result.data, usedModel: result.usedModel, wasFallback: result.wasFallback });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Erro na análise do Vault" });
  }
});

function parseLoopbackEndpoint(endpoint: string): URL {
  const parsedUrl = new URL(endpoint);
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") throw new Error("Protocolo do Obsidian inválido.");
  return parsedUrl;
}

app.post("/api/obsidian/test-connection", async (req, res) => {
  const { endpoint = "http://127.0.0.1:27124", apiKey } = req.body || {};
  try {
    const parsedUrl = parseLoopbackEndpoint(String(endpoint));
    if (!String(apiKey || "").trim()) return res.json({ success: false, message: "Token do Obsidian não informado." });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3_500);
    try {
      const response = await fetch(`${parsedUrl.protocol}//${parsedUrl.host}/`, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        signal: controller.signal,
      });
      if (response.ok) return res.json({ success: true, message: "Conectado com sucesso ao Obsidian Local REST API." });
      return res.json({ success: false, status: response.status, message: `Obsidian REST API retornou HTTP ${response.status}` });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: any) {
    return res.json({ success: false, message: err.message || `Obsidian Local REST API não alcançado em ${endpoint}.` });
  }
});

app.post("/api/obsidian/proxy", async (req, res) => {
  const { endpoint = "http://127.0.0.1:27124", apiKey, method = "GET", path: targetPath = "/", body, headers: customHeaders = {} } = req.body || {};
  try {
    const parsedUrl = parseLoopbackEndpoint(String(endpoint));
    if (!String(apiKey || "").trim()) return res.status(401).json({ success: false, error: "Token do Obsidian não informado." });
    const normalizedPath = String(targetPath).startsWith("/") ? String(targetPath) : `/${targetPath}`;
    const fullUrl = `${parsedUrl.protocol}//${parsedUrl.host}${normalizedPath}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4_000);
    try {
      const forwardHeaders: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json, text/plain, */*",
        ...(customHeaders as Record<string, string>),
      };
      if (body && typeof body === "string") forwardHeaders["Content-Type"] = "text/markdown; charset=utf-8";
      else if (body && typeof body === "object") forwardHeaders["Content-Type"] = "application/json";

      const fetchOptions: RequestInit = {
        method: String(method).toUpperCase(),
        headers: forwardHeaders,
        signal: controller.signal,
      };
      if (body !== undefined && !["GET", "HEAD"].includes(String(method).toUpperCase())) {
        fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
      }

      const obsidianRes = await fetch(fullUrl, fetchOptions);
      const contentType = obsidianRes.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await obsidianRes.json().catch(() => ({}))
        : await obsidianRes.text().catch(() => "");
      if (obsidianRes.ok) return res.json({ success: true, status: obsidianRes.status, data });
      return res.status(obsidianRes.status).json({ success: false, status: obsidianRes.status, error: `Obsidian REST API retornou HTTP ${obsidianRes.status}`, data });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: any) {
    return res.json({ success: false, error: `Falha ao contatar Obsidian REST API em ${endpoint}: ${err.message}` });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nisti Marketing server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
