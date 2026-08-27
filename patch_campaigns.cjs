const fs = require('fs');
const file = 'src/components/CampaignsView.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add the state
content = content.replace(
  'const [currentStep, setCurrentStep] = useState<number>(1);',
  'const [currentStep, setCurrentStep] = useState<number>(1);\n  const [isGeneratingGuidelines, setIsGeneratingGuidelines] = useState(false);'
);

// Add the function
const funcStr = `  const handleGenerateGuidelines = async () => {
    setIsGeneratingGuidelines(true);
    try {
      const res = await api.generateGuidelines({
        campaignName: campaignName,
        objective: objective,
        engineMode: engineMode,
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
  'const handleStepChange = (direction: "next" | "prev") => {',
  funcStr + '\n  const handleStepChange = (direction: "next" | "prev") => {'
);

// Replace the button
const oldBtn = `onClick={() => {
                            setCustomInstructions(
                              "Destacar que produzimos tiragens a partir de 10 unidades com laminação Soft Touch, miolo 90g e encadernação wire-o bronze. Evitar jargões corporativos genéricos, priorizando tom de boutique especializada."
                            );
                          }}`;

const newBtn = `onClick={handleGenerateGuidelines} disabled={isGeneratingGuidelines}`;

content = content.replace(oldBtn, newBtn);

// Also replace the button text/icon based on state
const oldBtnInner = `<Sparkles className="w-3 h-3 text-motor-info animate-pulse" />
                          <span>Gerar com IA</span>`;
                          
const newBtnInner = `{isGeneratingGuidelines ? (
                            <Loader2 className="w-3 h-3 text-motor-info animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3 text-motor-info animate-pulse" />
                          )}
                          <span>{isGeneratingGuidelines ? "Gerando..." : "Gerar com IA"}</span>`;

content = content.replace(oldBtnInner, newBtnInner);

// import Loader2 if not already there
if (!content.includes('Loader2')) {
  content = content.replace(
    'import {',
    'import {\n  Loader2,'
  );
}

fs.writeFileSync(file, content);
console.log('CampaignsView.tsx patched');
