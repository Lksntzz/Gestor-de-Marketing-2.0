import fs from "node:fs";

const patch = (path, edits) => {
  let content = fs.readFileSync(path, "utf8");
  for (const [from, to, label] of edits) {
    if (!content.includes(from)) throw new Error(`Pattern not found: ${label}`);
    content = content.replace(from, to);
  }
  fs.writeFileSync(path, content, "utf8");
};

patch("src/utils/dashboardIntelligence.ts", [
  [
    'const PRIORITY_SCORE: Record<MarketingTask["priority"], number> = {\n  urgent: 4,\n  high: 3,\n  medium: 2,\n  low: 1,\n};',
    'const PRIORITY_SCORE: Record<MarketingTask["priority"], number> = {\n  urgent: 4,\n  high: 3,\n  medium: 2,\n  low: 1,\n  unspecified: 0,\n};',
    "dashboard priority score",
  ],
  [
    '          : task.priority === "medium"\n            ? "Prioridade média"\n            : "Baixa prioridade";',
    '          : task.priority === "medium"\n            ? "Prioridade média"\n            : task.priority === "low"\n              ? "Baixa prioridade"\n              : "Prioridade não definida";',
    "dashboard priority label",
  ],
]);

patch("src/components/CampaignExecutionHub.tsx", [
  [
    '{task.priority.toUpperCase()}',
    '{task.priority === "unspecified" ? "NÃO DEFINIDA" : task.priority.toUpperCase()}',
    "campaign execution priority label",
  ],
]);

console.log("Final priority presentation fix applied.");
