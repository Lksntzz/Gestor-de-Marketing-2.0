const fs = require('fs');
const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

const newEndpoint = `
// ==========================================
// 2.5 GUIDELINES GENERATION
// ==========================================
app.post("/api/gemini/generate-guidelines", async (req, res) => {
  try {
    const { campaignName, objective, engineMode } = req.body;
    const name = campaignName || "Campanha";
    const obj = objective || "Marketing";

    const fallbackGenerator = () => ({
      guidelines: \`Campanha: \${name}. Foco no objetivo de \${obj}. Manter uma linguagem persuasiva e alinhada com o público da Nisti Print. Destacar os diferenciais de qualidade (Soft Touch, 90g, wire-o bronze).\`
    });

    if (engineMode === "local") {
      return res.json({
        success: true,
        data: fallbackGenerator(),
        usedModel: "local-rule-engine",
        wasFallback: false,
      });
    }

    const prompt = \`Atue como um Especialista em Marketing da Nisti Print (gráfica de planners e devocionais). 
O usuário está planejando uma campanha.
Nome da Campanha: \${name}
Objetivo Principal: \${obj}

Escreva diretrizes estratégicas (um parágrafo conciso de 3 a 5 linhas) sobre como essa campanha deve ser comunicada, o tom de voz ideal, métricas a focar e diferenciais a destacar. Retorne apenas o texto das diretrizes.\`;

    const schemaConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          guidelines: { type: Type.STRING },
        },
        required: ["guidelines"],
      },
    };

    const customApiKey = req.headers["x-gemini-api-key"];
    const result = await executeGeminiWithFallback(
      (model) => ({
        model,
        contents: prompt,
        config: schemaConfig,
      }),
      fallbackGenerator,
      customApiKey
    );

    res.json({
      success: true,
      data: result.data,
      usedModel: result.usedModel,
      wasFallback: result.wasFallback,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Erro na geração das diretrizes" });
  }
});
`;

content = content.replace('// ==========================================\n// 3. TASK EXTRACTION', newEndpoint + '\n// ==========================================\n// 3. TASK EXTRACTION');

fs.writeFileSync(file, content);
console.log('server.ts patched');
