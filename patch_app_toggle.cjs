const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldToggle = `  const handleToggleRule = (ruleId: string) => {
    setAutomationRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
    );
  };`;

const newToggle = `  const handleToggleRule = (ruleId: string) => {
    setAutomationRules((prev) => {
      if (prev.some((r) => r.id === ruleId)) {
        return prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
      }
      return [...prev, { id: ruleId, name: ruleId, enabled: false, executionCount: 0 }];
    });
  };`;

content = content.replace(oldToggle, newToggle);

fs.writeFileSync(file, content);
console.log('App.tsx patched for handleToggleRule');
