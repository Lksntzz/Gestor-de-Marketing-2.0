const fs = require('fs');
const file = 'src/components/CampaignsView.tsx';
let content = fs.readFileSync(file, 'utf8');

const funcStr = `  const handleGenerateGuidelines = async () => {
    setIsGeneratingGuidelines(true);
    try {
      const res = await api.generateGuidelines({
        campaignName: campaignName,
        objective: objective,
        engineMode: apiConfig.engineMode,
      });
      if (res.data?.guidelines) {
        setCustomInstructions(res.data.guidelines);
      } else {
        setCustomInstructions("Destacar que produzimos tiragens a partir de 10 unidades com laminação Soft Touch, miolo 90g e encadernação wire-o bronze. Evitar jargões genéricos, priorizando tom de boutique especializada.");
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Falha ao gerar diretrizes com IA");
    } finally {
      setIsGeneratingGuidelines(false);
    }
  };
`;

content = content.replace(
  '  const handleRunGeneration = async () => {',
  funcStr + '\n  const handleRunGeneration = async () => {'
);

fs.writeFileSync(file, content);
console.log('CampaignsView.tsx patched 2');
