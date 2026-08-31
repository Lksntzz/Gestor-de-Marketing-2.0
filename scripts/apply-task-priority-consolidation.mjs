import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const write = (path, content) => fs.writeFileSync(path, content, "utf8");

function replaceOnce(content, from, to, label) {
  const index = content.indexOf(from);
  if (index < 0) throw new Error(`Pattern not found: ${label}`);
  if (content.indexOf(from, index + from.length) >= 0) throw new Error(`Pattern duplicated: ${label}`);
  return content.slice(0, index) + to + content.slice(index + from.length);
}

{
  const path = "src/types.ts";
  let content = read(path);
  content = replaceOnce(
    content,
    'export type TaskPriority = "low" | "medium" | "high" | "urgent";',
    'export type TaskPriority = "unspecified" | "low" | "medium" | "high" | "urgent";',
    "TaskPriority",
  );
  write(path, content);
}

{
  const path = "src/domain/appStateSchemas.ts";
  let content = read(path);
  const from = 'priority: z.enum(["low", "medium", "high", "urgent"]),';
  const to = 'priority: z.enum(["unspecified", "low", "medium", "high", "urgent"]),';
  if (!content.includes(from)) throw new Error("Pattern not found: priority schemas");
  content = content.replaceAll(from, to);
  write(path, content);
}

{
  const path = "src/domain/taskExtractor.ts";
  let content = read(path);
  content = replaceOnce(
    content,
    '    let priority: TaskPriority = "medium";\n    if (body.includes("🔺") || body.includes("🔼") || body.toLowerCase().includes("#urgente")) {\n      priority = "urgent";\n    } else if (body.includes("⏫") || body.toLowerCase().includes("#alta")) {\n      priority = "high";\n    } else if (body.includes("🔽") || body.toLowerCase().includes("#baixa")) {\n      priority = "low";\n    }',
    '    let priority: TaskPriority = "unspecified";\n    if (body.includes("🔺") || body.toLowerCase().includes("#urgente")) {\n      priority = "urgent";\n    } else if (body.includes("⏫") || body.toLowerCase().includes("#alta")) {\n      priority = "high";\n    } else if (body.includes("🔼") || body.toLowerCase().includes("#media") || body.toLowerCase().includes("#média")) {\n      priority = "medium";\n    } else if (body.includes("🔽") || body.toLowerCase().includes("#baixa")) {\n      priority = "low";\n    }',
    "task extractor priority",
  );
  write(path, content);
}

{
  const path = "src/components/ExecutionTasksView.tsx";
  let content = read(path);
  content = replaceOnce(
    content,
    'const priorityLabels: Record<TaskPriority, string> = {\n  urgent: "Urgente",',
    'const priorityLabels: Record<TaskPriority, string> = {\n  unspecified: "Não definida",\n  urgent: "Urgente",',
    "priority labels",
  );
  content = replaceOnce(
    content,
    'const priorityClasses: Record<TaskPriority, string> = {\n  urgent:',
    'const priorityClasses: Record<TaskPriority, string> = {\n  unspecified: "border-outline-border bg-surface-elevated text-text-secondary",\n  urgent:',
    "priority classes",
  );
  write(path, content);
}

{
  const path = "src/utils/executionIntelligence.ts";
  let content = read(path);
  content = replaceOnce(
    content,
    'const priorityRank: Record<TaskPriority, number> = {\n  urgent: 0,\n  high: 1,\n  medium: 2,\n  low: 3,\n};',
    'const priorityRank: Record<TaskPriority, number> = {\n  urgent: 0,\n  high: 1,\n  medium: 2,\n  low: 3,\n  unspecified: 4,\n};',
    "priority rank",
  );
  write(path, content);
}

console.log("Explicit unspecified task priority migration applied.");
