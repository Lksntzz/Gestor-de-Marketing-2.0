const fs = require('fs');
const file = 'src/components/TasksAutomationView.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'const rule = automationRules[idx] || {',
  'const rule = automationRules.find(r => r.id === template.id) || {'
);

const btnOld = `onClick={() => onRunRuleNow(rule.id)}
                            className="px-2.5 py-1 bg-surface-card hover:bg-surface-elevated text-text-primary font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer border border-outline-border"`;

const btnNew = `onClick={() => onRunRuleNow(rule.id)}
                            disabled={apiConfig.connectionStatus !== "connected"}
                            className="px-2.5 py-1 bg-surface-card hover:bg-surface-elevated text-text-primary font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer border border-outline-border disabled:opacity-50 disabled:cursor-not-allowed"
                            title={apiConfig.connectionStatus !== "connected" ? "Conecte o cofre do Obsidian para executar" : "Executar agora"}`;

content = content.replace(btnOld, btnNew);

fs.writeFileSync(file, content);
console.log('TasksAutomationView.tsx patched');
