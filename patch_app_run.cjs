const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldRun = `    setAutomationRules((prev) =>
      prev.map((r) =>
        r.id === ruleId
          ? {
              ...r,
              executionCount: r.executionCount + 1,
              lastRun: new Date().toISOString().replace("T", " ").slice(0, 16),
            }
          : r
      )
    );`;

const newRun = `    setAutomationRules((prev) => {
      if (prev.some((r) => r.id === ruleId)) {
        return prev.map((r) =>
          r.id === ruleId
            ? {
                ...r,
                executionCount: r.executionCount + 1,
                lastRun: new Date().toISOString().replace("T", " ").slice(0, 16),
              }
            : r
        );
      }
      return [...prev, { id: ruleId, name: ruleId, enabled: true, executionCount: 1, lastRun: new Date().toISOString().replace("T", " ").slice(0, 16) }];
    });`;

content = content.replace(oldRun, newRun);

fs.writeFileSync(file, content);
console.log('App.tsx patched for handleRunRuleNow');
