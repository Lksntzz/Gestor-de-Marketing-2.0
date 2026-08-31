import type { Frontmatter, MarketingTask } from "../types";
import { normalizeFrontmatterTags, parseMarkdownDocument } from "./markdownFrontmatter";

export function buildObsidianOpenUri(vaultName: string, filePath?: string): string {
  const cleanVault = encodeURIComponent(vaultName || "MarketingVault");
  const cleanPath = encodeURIComponent((filePath || "").replace(/\.md$/i, ""));
  return `obsidian://open?vault=${cleanVault}&file=${cleanPath}`;
}

export function buildObsidianNewNoteUri(vaultName: string, filePath?: string, content?: string): string {
  const cleanVault = encodeURIComponent(vaultName || "MarketingVault");
  const cleanName = encodeURIComponent((filePath || "").replace(/\.md$/i, ""));
  const cleanContent = encodeURIComponent(content || "");
  return `obsidian://new?vault=${cleanVault}&name=${cleanName}&content=${cleanContent}`;
}

export function buildObsidianAdvancedUri(
  vaultName: string,
  params: { filepath?: string; commandid?: string; daily?: boolean },
): string {
  const cleanVault = encodeURIComponent(vaultName || "MarketingVault");
  let uri = `obsidian://advanced-uri?vault=${cleanVault}`;
  if (params.filepath) uri += `&filepath=${encodeURIComponent(params.filepath)}`;
  if (params.commandid) uri += `&commandid=${encodeURIComponent(params.commandid)}`;
  if (params.daily) uri += "&daily=true";
  return uri;
}

export function parseMarkdownNote(
  rawText = "",
): { frontmatter: Frontmatter; body: string; tags: string[]; wikilinks: string[] } {
  const parsed = parseMarkdownDocument(rawText);
  const frontmatter = parsed.frontmatter as Frontmatter;
  const tagMatches = parsed.body.match(/(^|\s)#([a-zA-Z0-9_\-\/]+)/g) || [];
  const bodyTags = tagMatches
    .map((value) => value.trim().replace(/^#/, ""))
    .filter((value) => value && !["1", "2", "3", "4", "5", "6"].includes(value));
  const tags = Array.from(new Set([
    ...normalizeFrontmatterTags(frontmatter.tags),
    ...bodyTags,
  ]));

  const linkMatches = parsed.body.match(/\[\[(.*?)\]\]/g) || [];
  const wikilinks = Array.from(
    new Set(
      linkMatches.map((link) =>
        link.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim(),
      ).filter(Boolean),
    ),
  );

  return { frontmatter, body: parsed.body, tags, wikilinks };
}

export function serializeMarkdownNote(frontmatter: Frontmatter = {}, body = ""): string {
  const keys = Object.keys(frontmatter || {});
  if (!keys.length) return body;

  let yaml = "---\n";
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      yaml += `${key}:\n`;
      value.forEach((item) => {
        yaml += `  - "${String(item).replace(/"/g, "'")}"\n`;
      });
    } else if (typeof value === "object") {
      yaml += `${key}: "${JSON.stringify(value).replace(/"/g, "'")}"\n`;
    } else if (typeof value === "string" && (value.includes(":") || value.includes("#") || value.includes("\n"))) {
      yaml += `${key}: "${value.replace(/"/g, '\\"')}"\n`;
    } else {
      yaml += `${key}: ${String(value)}\n`;
    }
  }
  return `${yaml}---\n\n${body}`;
}

export function formatToObsidianTask(task: {
  title: string;
  status: "todo" | "in-progress" | "done";
  dueDate?: string;
  dueTime?: string;
  reminderDate?: string;
  reminderTime?: string;
  priority?: string;
  tags?: string[];
}): string {
  const checkMark = task.status === "done" ? "x" : " ";
  let out = `- [${checkMark}] ${task.title || ""}`;

  if (task.dueDate) out += ` 📅 ${task.dueDate}`;
  if (task.dueTime) out += ` ⏰ ${task.dueTime}`;
  if (task.reminderDate && task.reminderTime) out += ` (@${task.reminderDate} ${task.reminderTime})`;

  if (task.priority === "urgent") out += " 🔺";
  else if (task.priority === "high") out += " ⏫";
  else if (task.priority === "medium") out += " 🔼";
  else if (task.priority === "low") out += " 🔽";

  for (const tag of task.tags || []) {
    const clean = tag.replace(/^#/, "");
    if (clean) out += ` #${clean}`;
  }
  return out;
}

export function parseObsidianTaskString(
  line = "",
  fallbackId: string,
): Partial<MarketingTask> | null {
  const match = line.match(/^[\s\-\*]*\[([ xX])\]\s*(.*)$/);
  if (!match) return null;

  const isDone = match[1].toLowerCase() === "x";
  let rest = match[2] || "";

  const dateMatch = rest.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
  const dueDate = dateMatch?.[1];
  if (dateMatch) rest = rest.replace(dateMatch[0], "");

  const timeMatch = rest.match(/⏰\s*(\d{1,2}:\d{2})/);
  const dueTime = timeMatch?.[1];
  if (timeMatch) rest = rest.replace(timeMatch[0], "");

  const reminderMatch = rest.match(/\(@(\d{4}-\d{2}-\d{2})\s*(\d{1,2}:\d{2})\)/);
  const reminderDate = reminderMatch?.[1];
  const reminderTime = reminderMatch?.[2];
  if (reminderMatch) rest = rest.replace(reminderMatch[0], "");

  let priority: MarketingTask["priority"] | undefined;
  if (rest.includes("🔺")) {
    priority = "urgent";
    rest = rest.replace("🔺", "");
  } else if (rest.includes("⏫")) {
    priority = "high";
    rest = rest.replace("⏫", "");
  } else if (rest.includes("🔼")) {
    priority = "medium";
    rest = rest.replace("🔼", "");
  } else if (rest.includes("🔽")) {
    priority = "low";
    rest = rest.replace("🔽", "");
  }

  const tags: string[] = [];
  const tagMatches = rest.match(/#([a-zA-Z0-9_\-\/]+)/g) || [];
  for (const tag of tagMatches) {
    tags.push(tag.replace("#", ""));
    rest = rest.replace(tag, "");
  }

  return {
    id: fallbackId,
    title: rest.trim(),
    status: isDone ? "done" : "todo",
    dueDate,
    dueTime,
    reminderDate,
    reminderTime,
    priority,
    tags,
    obsidianTaskString: line.trim(),
    isReminderActive: Boolean(reminderDate && reminderTime),
  };
}

export function downloadMarkdownFile(filename: string, content: string) {
  const cleanName = filename.endsWith(".md") ? filename : `${filename}.md`;
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = cleanName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
