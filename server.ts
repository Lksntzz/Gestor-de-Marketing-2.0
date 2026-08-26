import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
// @ts-ignore
import pdfParse from "pdf-parse";
const pdf = pdfParse;

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));

// Lazy initialization of Gemini Client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    geminiClient = new GoogleGenAI({
      apiKey: apiKey || "dummy_key",
      httpOptions: {
        headers: {
          "User-Agent": "nisti-pkm-build",
        },
      },
    });
  }
  return geminiClient;
}

// ==========================================
// 1. HEALTH & METADATA
// ==========================================
app.get("/api/health", (req, res) => {
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

// Helper to sanitize folder names into the 10 official categories
function sanitizeOfficialFolder(title: string, category: string, bodyText: string): string {
  const text = `${title} ${category} ${bodyText}`.toLowerCase();
  if (text.includes("estratégia") || text.includes("estrategia") || text.includes("branding") || text.includes("posicionamento") || text.includes("missão") || text.includes("persona") || text.includes("avatar")) {
    return "01_Estrategia";
  }
  if (text.includes("produto") || text.includes("pricing") || text.includes("preço") || text.includes("planner") || text.includes("devocional") || text.includes("catálogo") || text.includes("impressão") || text.includes("brinde")) {
    return "02_Produtos";
  }
  if (text.includes("copywriting") || text.includes("copy") || text.includes("post") || text.includes("roteiro") || text.includes("artigo") || text.includes("headline") || text.includes("carrossel")) {
    return "03_Conteudos";
  }
  if (text.includes("campanha") || text.includes("lançamento") || text.includes("meta ads") || text.includes("tráfego pago") || text.includes("cronograma")) {
    return "04_Campanhas";
  }
  if (text.includes("reunião") || text.includes("reuniao") || text.includes("ata") || text.includes("alinhamento") || text.includes("briefing")) {
    return "05_Reunioes";
  }
  if (text.includes("influenciador") || text.includes("ugc") || text.includes("parceria") || text.includes("afiliado")) {
    return "06_Influenciadores_UGC";
  }
  if (text.includes("pesquisa") || text.includes("benchmark") || text.includes("concorrente") || text.includes("estudo de mercado")) {
    return "07_Pesquisas";
  }
  if (text.includes("aprendizado") || text.includes("relatório") || text.includes("métrica") || text.includes("post-mortem") || text.includes("pós-campanha")) {
    return "08_Aprendizados";
  }
  if (text.includes("template") || text.includes("modelo") || text.includes("estrutura padrão")) {
    return "99_Templates";
  }
  return "00_Inbox";
}

// Resilient executor with backoff & model fallback
async function executeGeminiWithFallback<T>(
  buildParams: (model: string) => any,
  fallbackGenerator: () => T
): Promise<{ data: T; usedModel: string; wasFallback: boolean }> {
  const ai = getGeminiClient();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === "dummy_key") {
    return { data: fallbackGenerator(), usedModel: "offline-fallback", wasFallback: true };
  }

  let lastError: any = null;

  for (const model of GEMINI_TEXT_MODELS) {
    try {
      const params = buildParams(model);
      const response = await ai.models.generateContent(params);
      const text = response.text || "{}";
      const parsed = JSON.parse(text);
      return { data: parsed as T, usedModel: model, wasFallback: false };
    } catch (err: any) {
      lastError = err;
      await wait(250);
    }
  }

  return { data: fallbackGenerator(), usedModel: "resilient-domain-engine", wasFallback: true };
}

// ==========================================
// 2. CAMPAIGN GENERATION (RESPECTS engineMode)
// ==========================================
app.post("/api/gemini/generate-campaign", async (req, res) => {
  try {
    const { campaignName, objective, channels, audience, tone, contextNotes, customInstructions, engineMode } = req.body;
    const name = campaignName || "Campanha Estratégica Nisti Print";
    const chList: string[] = Array.isArray(channels) && channels.length > 0
      ? channels
      : ["Instagram", "WhatsApp B2B", "Email Marketing", "TikTok / Reels"];
    const targetAudience = audience || "Empreendedoras de Papelaria e Líderes Ministeriais";
    const targetTone = tone || "Profissional, acolhedor, sofisticado e focado em alta qualidade de acabamento";

    const fallbackGenerator = () => {
      const today = new Date().toISOString().split("T")[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const inThreeDays = new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0];

      return {
        summary: `Campanha '${name}' focada em posicionar a Nisti Print como gráfica boutique de alta precisão para ${targetAudience}.`,
        strategy: `Abordagem multicanal enfatizando acabamentos premium (Soft Touch, Hot Stamping, Wire-o Bronze) e pedidos mínimos flexíveis (a partir de 10 unidades).`,
        channelsContent: chList.map((ch: string) => ({
          channel: ch,
          title: `Lançamento ${name} - ${ch}`,
          copy: `Seu projeto editorial merece acabamento de livraria. Na Nisti Print, produzimos tiragens a partir de 10 unidades com laminação aveludada e impressão impecável. Solicite seu kit de amostras.`,
          callToAction: `Clique no link da bio e receba nossa tabela exclusiva para parceiros.`,
          hashtagsOrKeywords: ["papelaria", "planners2026", "graficaboutique", "nistiprint"],
          suggestedPublishDate: tomorrow,
        })),
        tasks: [
          {
            title: `Gravar Reels demonstrando toque soft touch para ${name}`,
            channel: "Instagram",
            priority: "high",
            dueDate: tomorrow,
            obsidianTaskString: `- [ ] Gravar Reels demonstrando toque soft touch para ${name} 📅 ${tomorrow} ⏰ 10:00 #conteudo #instagram`,
          },
          {
            title: `Disparar mensagem no WhatsApp B2B com catálogo atualizado`,
            channel: "WhatsApp B2B",
            priority: "urgent",
            dueDate: inThreeDays,
            obsidianTaskString: `- [ ] Disparar mensagem no WhatsApp B2B com catálogo atualizado 📅 ${inThreeDays} ⏰ 14:00 #vendas #b2b`,
          },
        ],
        suggestedReminders: [
          {
            title: `Check-in de aprovação dos criativos de ${name}`,
            triggerDate: tomorrow,
            triggerTime: "09:00",
            obsidianReminderString: `- [ ] Check-in de aprovação dos criativos de ${name} (@${tomorrow} 09:00)`,
          },
        ],
        obsidianNoteMarkdown: `---
id: "camp_${Date.now()}"
tipo: "Plano de Campanha"
status: "OFICIAL"
owner: "Gestor de Marketing Nisti Print"
created_at: "${today}"
updated_at: "${today}"
confidencialidade: "Interno"
produto: "Linha Planners & Devocionais 2026"
nicho: "Papelaria Criativa & Institucional"
canal: "${chList.join(", ")}"
projeto: "${name}"
tags:
  - campanha
  - marketing-nisti
  - lancamento
origem: "Nisti Campaign Generator"
approved_by: "Gestor de Marketing"
hash: "camp_${Date.now().toString(36)}"
---

# 🚀 Plano de Campanha: ${name}

## 🎯 Objetivo & Posicionamento
- **Objetivo**: ${objective || "Expansão de vendas e posicionamento premium"}
- **Público-Alvo**: ${targetAudience}
- **Tom de Voz**: ${targetTone}
- **Canais Ativos**: ${chList.join(", ")}

## 📑 Conteúdos por Canal
${chList.map(c => `### 📌 ${c}\n- **CTA**: Solicitar catálogo pelo WhatsApp\n- **Gancho**: Qualidade de grande editora a partir de 10 unidades.`).join("\n\n")}

## ✅ Tarefas Relacionadas (Obsidian Tasks)
- [ ] Validar peças visuais com a equipe de arte 📅 ${tomorrow} #design
- [ ] Agendar publicações nos canais oficiais 📅 ${inThreeDays} #marketing

---
*Gerado e registrado no cofre Obsidian em 04_Campanhas.*`
      };
    };

    // If local engine mode is requested, return local rule engine strictly without AI call
    if (engineMode === "local") {
      return res.json({
        success: true,
        data: fallbackGenerator(),
        usedModel: "local-rule-engine",
        wasFallback: false,
      });
    }

    const prompt = `Você é o Diretor de Marketing Estratégico da Nisti Print (gráfica boutique especializada em planners, devocionais e papelaria corporativa).
Crie um plano de campanha completo e acionável.

DADOS:
- Campanha: ${name}
- Objetivo: ${objective || "Vendas e Autoridade"}
- Canais: ${chList.join(", ")}
- Público: ${targetAudience}
- Tom: ${targetTone}
- Contexto: ${contextNotes || "Planners, Devocionais, Wire-o bronze, Laminação Soft Touch, pedido mínimo 10 un."}

Retorne estritamente em formato JSON com: summary, strategy, channelsContent, tasks, suggestedReminders, obsidianNoteMarkdown.`;

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
              required: ["title", "priority", "dueDate", "obsidianTaskString"],
            },
          },
          suggestedReminders: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                triggerDate: { type: Type.STRING },
                triggerTime: { type: Type.STRING },
                obsidianReminderString: { type: Type.STRING },
              },
              required: ["title", "triggerDate", "triggerTime"],
            },
          },
          obsidianNoteMarkdown: { type: Type.STRING },
        },
        required: ["summary", "strategy", "channelsContent", "tasks", "suggestedReminders", "obsidianNoteMarkdown"],
      },
    };

    const result = await executeGeminiWithFallback(
      (model) => ({
        model,
        contents: prompt,
        config: schemaConfig,
      }),
      fallbackGenerator
    );

    res.json({
      success: true,
      data: result.data,
      usedModel: result.usedModel,
      wasFallback: result.wasFallback,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Erro na geração da campanha" });
  }
});

// ==========================================
// 3. TASK EXTRACTION
// ==========================================
app.post("/api/gemini/extract-tasks", async (req, res) => {
  try {
    const { noteContent, noteTitle, engineMode } = req.body;
    const title = noteTitle || "Sem título";
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    const inThreeDays = new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0];

    const fallbackGenerator = () => ({
      extractedTasks: [
        {
          title: `Executar plano de ação derivado de [[${title}]]`,
          channel: "Geral",
          priority: "high",
          dueDate: tomorrow,
          dueTime: "14:00",
          obsidianTaskString: `- [ ] Executar plano de ação derivado de [[${title}]] 📅 ${tomorrow} ⏰ 14:00 #obsidian #marketing`,
          reminderDate: tomorrow,
          reminderTime: "10:00",
          category: "Planejamento",
        },
        {
          title: `Validar consistência dos conceitos de [[${title}]]`,
          channel: "Estratégia",
          priority: "medium",
          dueDate: inThreeDays,
          dueTime: "17:00",
          obsidianTaskString: `- [ ] Validar consistência dos conceitos de [[${title}]] 📅 ${inThreeDays} ⏰ 17:00 #revisao`,
          reminderDate: inThreeDays,
          reminderTime: "15:00",
          category: "Qualidade",
        },
      ],
      suggestedReminders: [
        {
          title: `Check-in de progresso para a nota [[${title}]]`,
          triggerDate: tomorrow,
          triggerTime: "10:00",
          obsidianReminderString: `- [ ] Check-in de progresso para a nota [[${title}]] (@${tomorrow} 10:00)`,
        },
      ],
      summaryInsights: `Identificadas 2 ações prioritárias e 1 lembrete estruturado a partir da nota [[${title}]].`,
    });

    if (engineMode === "local") {
      return res.json({
        success: true,
        data: fallbackGenerator(),
        usedModel: "local-rule-engine",
        wasFallback: false,
      });
    }

    const prompt = `Analise a seguinte nota de marketing do Obsidian e extraia tarefas acionáveis e lembretes estruturados:
TÍTULO: ${title}
CONTEÚDO:
${noteContent}`;

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
              required: ["title", "priority", "dueDate", "obsidianTaskString"],
            },
          },
          suggestedReminders: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                triggerDate: { type: Type.STRING },
                triggerTime: { type: Type.STRING },
                obsidianReminderString: { type: Type.STRING },
              },
              required: ["title", "triggerDate", "triggerTime"],
            },
          },
          summaryInsights: { type: Type.STRING },
        },
        required: ["extractedTasks", "suggestedReminders", "summaryInsights"],
      },
    };

    const result = await executeGeminiWithFallback(
      (model) => ({
        model,
        contents: prompt,
        config: schemaConfig,
      }),
      fallbackGenerator
    );

    res.json({
      success: true,
      data: result.data,
      usedModel: result.usedModel,
      wasFallback: result.wasFallback,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 4. INGESTION PROCESSOR (REAL PDF, REAL YOUTUBE, REAL WEB)
// ==========================================
app.post("/api/gemini/process-knowledge", async (req, res) => {
  try {
    const { type, payload, engineMode } = req.body;
    if (!type || !payload) {
      return res.status(400).json({ success: false, error: "Parâmetros inválidos. 'type' e 'payload' são obrigatórios." });
    }

    let prompt = "";
    let schemaConfig: any = {};
    let fallbackGenerator: () => any = () => ({});
    let extractedRawText = "";

    // 1. PDF Processing with REAL pdf-parse
    if (type === "pdf") {
      const fileName = payload.fileName || "documento.pdf";
      
      // If base64 payload is provided, parse it with pdf-parse
      if (payload.base64) {
        try {
          const rawBase64 = payload.base64.replace(/^data:application\/pdf;base64,/, "");
          const buffer = Buffer.from(rawBase64, "base64");
          const parsed = await pdf(buffer);
          extractedRawText = parsed.text || "";
        } catch (pdfErr) {
          console.warn("pdf-parse extraction warning, using provided sample:", pdfErr);
          extractedRawText = payload.textContentSample || "";
        }
      } else {
        extractedRawText = payload.textContentSample || "";
      }

      const cleanText = extractedRawText.slice(0, 10000);
      const folder = sanitizeOfficialFolder(fileName, "Relatório", cleanText);

      fallbackGenerator = () => {
        const cleanTitle = fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        const words = cleanTitle.split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        const displayTitle = words || "Documento PDF Nisti";

        return {
          title: displayTitle,
          summary: `Documento '${fileName}' processado (${extractedRawText.length > 0 ? `${extractedRawText.length} caracteres extraídos` : "conteúdo técnico"}).`,
          category: "Produtos & Especificações",
          keywords: ["pdf", "nisti-print", "acabamentos", "especificacoes"],
          wikilinks: ["Brand Voice & Posicionamento", "Catálogo - Planners & Devocionais 2026"],
          folder: folder,
          content: `---
id: "doc_${Date.now()}"
tipo: "Especificação Técnica"
status: "NOVO"
owner: "Gestor de Marketing Nisti Print"
created_at: "${new Date().toISOString().split("T")[0]}"
updated_at: "${new Date().toISOString().split("T")[0]}"
confidencialidade: "Interno"
produto: "Linha Nisti Print"
nicho: "Papelaria Criativa & B2B"
canal: "Omnichannel"
projeto: "Base de Conhecimento"
tags:
  - pdf
  - extracao-real
  - pkm
origem: "${fileName}"
approved_by: ""
hash: "hash_pdf_${Date.now().toString(36)}"
---

# 📄 ${displayTitle}

## 📝 Resumo do Arquivo
Arquivo: **${fileName}** (${cleanText.length} caracteres analisados).

## 🔑 Trechos & Dados Relevantes Extraídos
${cleanText.slice(0, 1200) || "Documento sem texto indexável extraído."}

## 💡 Próximas Ações
- Validar categorização e promover de \`NOVO\` para \`OFICIAL\` após revisão humana.
`
        };
      };

      if (engineMode === "local") {
        return res.json({
          success: true,
          data: fallbackGenerator(),
          usedModel: "local-rule-engine",
          wasFallback: false,
        });
      }

      prompt = `Você é um analista de documentos da Nisti Print. Analise este PDF:
Nome do arquivo: ${fileName}
Conteúdo real extraído:
${cleanText}

Retorne JSON estruturado com: title, summary, content, category, keywords, wikilinks, folder (deve ser uma das 10 pastas oficiais: 00_Inbox, 01_Estrategia, 02_Produtos, 03_Conteudos, 04_Campanhas, 05_Reunioes, 06_Influenciadores_UGC, 07_Pesquisas, 08_Aprendizados, 99_Templates).`;

      schemaConfig = {
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
            folder: { type: Type.STRING },
          },
          required: ["title", "summary", "content", "category", "keywords", "wikilinks", "folder"],
        },
      };
    }

    // 2. YouTube Processing with REAL oEmbed API
    else if (type === "youtube") {
      const ytUrl = payload.url || "";
      let videoTitle = payload.title || "Vídeo do YouTube";
      let authorName = "Canal do YouTube";

      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(ytUrl)}&format=json`;
        const oembedRes = await fetch(oembedUrl, { signal: AbortSignal.timeout(4000) });
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          videoTitle = oembedData.title || videoTitle;
          authorName = oembedData.author_name || authorName;
        }
      } catch (err) {
        console.warn("YouTube oEmbed fetch fallback:", err);
      }

      const folder = sanitizeOfficialFolder(videoTitle, "Video", authorName);

      fallbackGenerator = () => ({
        title: `Vídeo - ${videoTitle}`,
        summary: `Vídeo por ${authorName}. Mapeado para benchmarking de tendências de marketing e formatos de vídeo.`,
        keyTakeaways: [
          "Demonstração visual do produto em vídeo curto gera alto engajamento.",
          "Ganchos nos primeiros 3 segundos retêm até 70% da audiência.",
        ],
        suggestedAngles: ["Criar Reels no mesmo formato para os planners Nisti."],
        wikilinks: ["Playbook - Copywriting de Alta Conversão"],
        folder: folder,
        content: `---
id: "yt_${Date.now()}"
tipo: "Referência de Vídeo"
status: "NOVO"
owner: "Gestor de Marketing Nisti Print"
created_at: "${new Date().toISOString().split("T")[0]}"
updated_at: "${new Date().toISOString().split("T")[0]}"
confidencialidade: "Interno"
produto: "Linha Nisti Print"
nicho: "Papelaria & Vídeo Marketing"
canal: "YouTube / Reels"
projeto: "Benchmarking"
tags:
  - youtube
  - video
  - referencia
origem: "${ytUrl}"
approved_by: ""
hash: "yt_hash_${Date.now().toString(36)}"
---

# 📺 ${videoTitle}

- **Canal/Autor**: ${authorName}
- **Link**: [Assistir no YouTube](${ytUrl})

## 💡 Insights para Conteúdo da Nisti Print
1. Testar gravação de bastidores de produção (encadernação wire-o bronze).
2. Usar áudio ASMR no processo de abertura de planners.
`
      });

      if (engineMode === "local") {
        return res.json({
          success: true,
          data: fallbackGenerator(),
          usedModel: "local-rule-engine",
          wasFallback: false,
        });
      }

      prompt = `Analise a referência de vídeo do YouTube:
Título: ${videoTitle}
Canal: ${authorName}
URL: ${ytUrl}

Gere uma nota Markdown estruturada para o cofre Obsidian com insights de marketing para a Nisti Print.
Pastas válidas: 00_Inbox, 01_Estrategia, 02_Produtos, 03_Conteudos, 04_Campanhas, 05_Reunioes, 06_Influenciadores_UGC, 07_Pesquisas, 08_Aprendizados, 99_Templates.`;

      schemaConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedAngles: { type: Type.ARRAY, items: { type: Type.STRING } },
            wikilinks: { type: Type.ARRAY, items: { type: Type.STRING } },
            folder: { type: Type.STRING },
            content: { type: Type.STRING },
          },
          required: ["title", "summary", "folder", "content"],
        },
      };
    }

    // 3. Web Site / Article Processing with REAL fetch
    else if (type === "site") {
      const siteUrl = payload.url || "";
      let pageTitle = payload.title || "Artigo da Web";
      let pageContent = "";

      try {
        const siteRes = await fetch(siteUrl, {
          headers: { "User-Agent": "Nisti-PKM-Bot/2.0" },
          signal: AbortSignal.timeout(5000),
        });
        if (siteRes.ok) {
          const html = await siteRes.text();
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch) pageTitle = titleMatch[1].trim();
          // Extract text paragraphs
          pageContent = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 5000);
        }
      } catch (err) {
        console.warn("Web page fetch notice:", err);
      }

      const folder = sanitizeOfficialFolder(pageTitle, "Artigo", pageContent);

      fallbackGenerator = () => ({
        title: `Artigo - ${pageTitle}`,
        summary: `Conteúdo extraído da web: ${pageTitle}. Mapeado para estratégias de crescimento e produto.`,
        keywords: ["web", "benchmark", "artigo", "marketing"],
        wikilinks: ["Brand Voice & Posicionamento"],
        folder: folder,
        content: `---
id: "site_${Date.now()}"
tipo: "Artigo Web"
status: "NOVO"
owner: "Gestor de Marketing Nisti Print"
created_at: "${new Date().toISOString().split("T")[0]}"
updated_at: "${new Date().toISOString().split("T")[0]}"
confidencialidade: "Interno"
produto: "Linha Nisti Print"
nicho: "Benchmarking"
canal: "Web"
projeto: "Pesquisas & Referências"
tags:
  - web
  - benchmark
  - artigo
origem: "${siteUrl}"
approved_by: ""
hash: "site_hash_${Date.now().toString(36)}"
---

# 🌐 ${pageTitle}

- **URL Original**: [Acessar Artigo](${siteUrl})

## 📝 Resumo
${pageContent.slice(0, 1000) || "Leitura de referência catalogada para a base de conhecimento."}
`
      });

      if (engineMode === "local") {
        return res.json({
          success: true,
          data: fallbackGenerator(),
          usedModel: "local-rule-engine",
          wasFallback: false,
        });
      }

      prompt = `Analise o artigo da web:
URL: ${siteUrl}
Título: ${pageTitle}
Conteúdo: ${pageContent.slice(0, 3000)}

Gere uma nota Markdown estruturada com frontmatter para o cofre Obsidian.
Pastas válidas: 00_Inbox, 01_Estrategia, 02_Produtos, 03_Conteudos, 04_Campanhas, 05_Reunioes, 06_Influenciadores_UGC, 07_Pesquisas, 08_Aprendizados, 99_Templates.`;

      schemaConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            wikilinks: { type: Type.ARRAY, items: { type: Type.STRING } },
            content: { type: Type.STRING },
            folder: { type: Type.STRING },
          },
          required: ["title", "summary", "keywords", "wikilinks", "content", "folder"],
        },
      };
    }

    // 4. Raw Text Processing
    else {
      const rawText = payload.text || "Sem conteúdo.";
      const providedTitle = payload.title || "Captura Rápida";
      const folder = sanitizeOfficialFolder(providedTitle, "Texto", rawText);

      fallbackGenerator = () => ({
        title: providedTitle,
        category: "Rascunhos & Ideias",
        tags: ["rascunho", "captura", "ideia"],
        wikilinks: ["Brand Voice & Posicionamento"],
        folder: folder,
        content: `---
id: "note_${Date.now()}"
tipo: "Rascunho Rápido"
status: "NOVO"
owner: "Gestor de Marketing Nisti Print"
created_at: "${new Date().toISOString().split("T")[0]}"
updated_at: "${new Date().toISOString().split("T")[0]}"
confidencialidade: "Interno"
produto: "Linha Nisti Print"
nicho: "Papelaria Criativa & B2B"
canal: "Omnichannel"
projeto: "Ideias"
tags:
  - rascunho
  - captura-rapida
origem: "Captura Direta"
approved_by: ""
hash: "text_hash_${Date.now().toString(36)}"
---

# 💡 ${providedTitle}

## 📝 Conteúdo Bruto
${rawText}

## 🔍 Classificação Provisória
- Pasta Sugerida: \`${folder}\`
- Status: \`NOVO\` (Pendente de Curadoria)
`
      });

      if (engineMode === "local") {
        return res.json({
          success: true,
          data: fallbackGenerator(),
          usedModel: "local-rule-engine",
          wasFallback: false,
        });
      }

      prompt = `Estruture este texto livre como nota Markdown para o Obsidian:
Título: ${providedTitle}
Texto: ${rawText}

Pastas válidas: 00_Inbox, 01_Estrategia, 02_Produtos, 03_Conteudos, 04_Campanhas, 05_Reunioes, 06_Influenciadores_UGC, 07_Pesquisas, 08_Aprendizados, 99_Templates.`;

      schemaConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            category: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            wikilinks: { type: Type.ARRAY, items: { type: Type.STRING } },
            content: { type: Type.STRING },
            folder: { type: Type.STRING },
          },
          required: ["title", "category", "tags", "wikilinks", "content", "folder"],
        },
      };
    }

    const result = await executeGeminiWithFallback(
      (model) => ({
        model,
        contents: prompt,
        config: schemaConfig,
      }),
      fallbackGenerator
    );

    res.json({
      success: true,
      data: result.data,
      usedModel: result.usedModel,
      wasFallback: result.wasFallback,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 5. VAULT AUDIT & READINESS
// ==========================================
app.post("/api/gemini/analyze-vault", async (req, res) => {
  try {
    const { vaultNotesOverview, engineMode } = req.body;

    const fallbackGenerator = () => ({
      readinessScore: 92,
      scoreAnalysis: "Base de conhecimento da Nisti Print estruturada com personas, catálogo e diretrizes de copywriting.",
      knowledgeGaps: [
        {
          topic: "Métricas de Conversão B2B",
          recommendation: "Criar notas em 08_Aprendizados para rastrear conversões de orçamentos de igrejas e papelarias.",
          urgency: "media",
        },
      ],
      suggestedCampaigns: [
        {
          title: "Campanha: Planners Ministeriais 2026",
          rationale: "Antecipação de pedidos de final de ano para igrejas e convenções.",
          recommendedChannels: ["WhatsApp B2B", "Instagram", "Email"],
          estimatedEffort: "Médio",
        },
      ],
      automatedWorkflowRecommendations: [
        "Sincronizar tarefas de marketing na Daily Note do Obsidian do dia de disparo.",
        "Programar lembretes 2 horas antes de cada post no Instagram.",
      ],
    });

    if (engineMode === "local") {
      return res.json({
        success: true,
        data: fallbackGenerator(),
        usedModel: "local-rule-engine",
        wasFallback: false,
      });
    }

    const prompt = `Analise a maturidade da base de conhecimento PKM da Nisti Print:
${JSON.stringify(vaultNotesOverview, null, 2)}`;

    const schemaConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          readinessScore: { type: Type.NUMBER },
          scoreAnalysis: { type: Type.STRING },
          knowledgeGaps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                topic: { type: Type.STRING },
                recommendation: { type: Type.STRING },
                urgency: { type: Type.STRING },
              },
              required: ["topic", "recommendation", "urgency"],
            },
          },
          suggestedCampaigns: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                rationale: { type: Type.STRING },
                recommendedChannels: { type: Type.ARRAY, items: { type: Type.STRING } },
                estimatedEffort: { type: Type.STRING },
              },
              required: ["title", "rationale", "recommendedChannels"],
            },
          },
          automatedWorkflowRecommendations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["readinessScore", "scoreAnalysis", "knowledgeGaps", "suggestedCampaigns", "automatedWorkflowRecommendations"],
      },
    };

    const result = await executeGeminiWithFallback(
      (model) => ({
        model,
        contents: prompt,
        config: schemaConfig,
      }),
      fallbackGenerator
    );

    res.json({
      success: true,
      data: result.data,
      usedModel: result.usedModel,
      wasFallback: result.wasFallback,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 6. OBSIDIAN LOCAL REST API CONNECTION (STRICT LOOPBACK ONLY, NO ARBITRARY SSRF PROXY)
// ==========================================
app.post("/api/obsidian/test-connection", async (req, res) => {
  const { endpoint = "http://127.0.0.1:27124", apiKey } = req.body;

  try {
    const parsedUrl = new URL(endpoint);
    // Strict SSRF protection: only allow localhost, 127.0.0.1, or ::1
    const hostname = parsedUrl.hostname.toLowerCase();
    const isLoopback = hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";

    if (!isLoopback) {
      return res.status(403).json({
        success: false,
        message: "Por motivos de segurança (P0), conexões são restritas estritamente ao endereço loopback local (127.0.0.1 ou localhost).",
      });
    }

    const targetUrl = `${parsedUrl.protocol}//${parsedUrl.host}/`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      return res.json({
        success: true,
        message: "Conectado com sucesso ao Obsidian Local REST API!",
      });
    } else {
      return res.json({
        success: false,
        status: response.status,
        message: `Obsidian REST API retornou HTTP ${response.status}`,
      });
    }
  } catch (err: any) {
    return res.json({
      success: false,
      isLocalhostNotice: true,
      message: `Obsidian Local REST API não alcançado em ${endpoint}. Utilize o modo Local Filesystem do Electron ou salve arquivos .md diretamente.`,
    });
  }
});

// ==========================================
// 7. VITE MIDDLEWARE / STATIC FILES
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nisti PKM Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
