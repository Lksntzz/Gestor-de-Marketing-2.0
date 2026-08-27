const fs = require('fs');
const file = 'src/services/api.ts';
let content = fs.readFileSync(file, 'utf8');

const newMethod = `  async generateGuidelines(payload: { campaignName: string; objective: string; engineMode: string }) {
    const headers = await getSessionHeaders();
    const res = await fetch("/api/gemini/generate-guidelines", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error);
    return result;
  },

  async generateCampaign(payload: GenerateCampaignPayload) {`;

content = content.replace('async generateCampaign(payload: GenerateCampaignPayload) {', newMethod);

fs.writeFileSync(file, content);
console.log('api.ts patched');
