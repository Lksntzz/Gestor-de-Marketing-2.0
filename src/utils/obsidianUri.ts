import { Frontmatter, MarketingTask } from "../types";

/**
 * Builds standard Obsidian URI to open a note
 */
export function buildObsidianOpenUri(vaultName: string, filePath?: string): string {
  const cleanVault = encodeURIComponent(vaultName || "MarketingVault");
  const cleanPath = encodeURIComponent((filePath || "").replace(/\.md$/, ""));
  return `obsidian://open?vault=${cleanVault}&file=${cleanPath}`;
}

/**
 * Builds Obsidian URI to create a new note
 */
export function buildObsidianNewNoteUri(vaultName: string, filePath?: string, content?: string): string {
  const cleanVault = encodeURIComponent(vaultName || "MarketingVault");
  const cleanName = encodeURIComponent((filePath || "").replace(/\.md$/, ""));
  const cleanContent = encodeURIComponent(content || "");
  return `obsidian://new?vault=${cleanVault}&name=${cleanName}&content=${cleanContent}`;
}

/**
 * Builds Obsidian Advanced URI for command execution or daily notes
 */
export function buildObsidianAdvancedUri(vaultName: string, params: { filepath?: string; commandid?: string; daily?: boolean }): string {
  const cleanVault = encodeURIComponent(vaultName || "MarketingVault");
  let uri = `obsidian://advanced-uri?vault=${cleanVault}`;
  if (params.filepath) uri += `&filepath=${encodeURIComponent(params.filepath || "")}`;
  if (params.commandid) uri += `&commandid=${encodeURIComponent(params.commandid || "")}`;
  if (params.daily) uri += `&daily=true`;
  return uri;
}

/**
 * Extracts YAML frontmatter and raw body from Markdown text
 */
export function parseMarkdownNote(rawText: string = ""): { frontmatter: Frontmatter; body: string; tags: string[]; wikilinks: string[] } {
  const trimmed = (rawText || "").trim();
  let frontmatter: Frontmatter = {};
  let body = rawText || "";

  if (trimmed.startsWith("---")) {
    const secondFence = trimmed.indexOf("\n---", 3);
    if (secondFence !== -1) {
      const yamlBlock = trimmed.slice(3, secondFence).trim();
      body = trimmed.slice(secondFence + 4).trim();

      // Simple key-value YAML parser
      yamlBlock.split("\n").forEach((line) => {
        const colonIdx = line.indexOf(":");
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          let val = line.slice(colonIdx + 1).trim();
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1);
          } else if (val.startsWith("'") && val.endsWith("'")) {
            val = val.slice(1, -1);
          }
          frontmatter[key] = val;
        }
      });
    }
  }

  // Extract #tags (excluding Markdown headers # Header)
  const tagMatches = body.match(/(^|\s)#([a-zA-Z0-9_\-\/]+)/g) || [];
  const tags = Array.from(new Set(tagMatches.map((t) => (t || "").trim().replace(/^#/, "")))).filter(
    (t) => !["1", "2", "3", "4", "5", "6"].includes(t)
  );

  // Extract [[wikilinks]]
  const linkMatches = body.match(/\[\[(.*?)\]\]/g) || [];
  const wikilinks = Array.from(
    new Set(
      linkMatches.map((l) => {
        const inner = (l || "").replace(/^\[\[/, "").replace(/\]\]$/, "");
        return inner.split("|")[0].trim();
      })
    )
  );

  return { frontmatter, body, tags, wikilinks };
}

/**
 * Formats frontmatter and markdown body into a complete note
 */
export function serializeMarkdownNote(frontmatter: Frontmatter = {}, body: string = ""): string {
  const keys = Object.keys(frontmatter || {});
  if (keys.length === 0) return body || "";

  let yaml = "---\n";
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      yaml += `${key}:\n`;
      value.forEach((item) => {
        yaml += `  - ${item}\n`;
      });
    } else if (typeof value === "string" && (value.includes(":") || value.includes("#") || value.includes("\n"))) {
      yaml += `${key}: "${String(value || "").replace(/"/g, '\\"')}"\n`;
    } else {
      yaml += `${key}: ${value}\n`;
    }
  }
  yaml += "---\n\n";
  return `${yaml}${body || ""}`;
}

/**
 * Formats a MarketingTask into standard Obsidian Tasks plugin syntax
 * Example: - [ ] Revisar copy do anúncio 📅 2026-08-28 ⏰ 14:00 #marketing 🔺
 */
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

  if (task.dueDate) {
    out += ` 📅 ${task.dueDate}`;
  }
  if (task.dueTime) {
    out += ` ⏰ ${task.dueTime}`;
  }
  if (task.reminderDate && task.reminderTime) {
    out += ` (@${task.reminderDate} ${task.reminderTime})`;
  }

  if (task.priority === "urgent") {
    out += ` 🔺`;
  } else if (task.priority === "high") {
    out += ` ⏫`;
  } else if (task.priority === "medium") {
    out += ` 🔼`;
  } else if (task.priority === "low") {
    out += ` 🔽`;
  }

  if (task.tags && task.tags.length > 0) {
    task.tags.forEach((tag) => {
      const clean = (tag || "").replace(/^#/, "");
      if (clean) out += ` #${clean}`;
    });
  }

  return out;
}

/**
 * Parses an Obsidian task line into structured task data
 */
export function parseObsidianTaskString(line: string = "", fallbackId: string): Partial<MarketingTask> | null {
  const match = (line || "").match(/^[\s\-\*]*\[([ xX])\]\s*(.*)$/);
  if (!match) return null;

  const isDone = (match[1] || "").toLowerCase() === "x";
  let rest = match[2] || "";

  // Extract Due Date 📅 YYYY-MM-DD
  const dateMatch = rest.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
  const dueDate = dateMatch ? dateMatch[1] : new Date().toISOString().split("T")[0];
  if (dateMatch) rest = rest.replace(dateMatch[0], "");

  // Extract Due Time ⏰ HH:mm
  const timeMatch = rest.match(/⏰\s*(\d{1,2}:\d{2})/);
  const dueTime = timeMatch ? timeMatch[1] : undefined;
  if (timeMatch) rest = rest.replace(timeMatch[0], "");

  // Extract Reminder (@YYYY-MM-DD HH:mm)
  const reminderMatch = rest.match(/\(@(\d{4}-\d{2}-\d{2})\s*(\d{1,2}:\d{2})\)/);
  const reminderDate = reminderMatch ? reminderMatch[1] : undefined;
  const reminderTime = reminderMatch ? reminderMatch[2] : undefined;
  if (reminderMatch) rest = rest.replace(reminderMatch[0], "");

  // Extract priority
  let priority: "urgent" | "high" | "medium" | "low" = "medium";
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

  // Extract tags
  const tags: string[] = [];
  const tagMatches = rest.match(/#([a-zA-Z0-9_\-\/]+)/g);
  if (tagMatches) {
    tagMatches.forEach((t) => {
      tags.push((t || "").replace("#", ""));
      rest = rest.replace(t, "");
    });
  }

  const cleanTitle = rest.trim();

  return {
    id: fallbackId,
    title: cleanTitle,
    status: isDone ? "done" : "todo",
    dueDate,
    dueTime,
    reminderDate,
    reminderTime,
    priority,
    tags,
    obsidianTaskString: (line || "").trim(),
    isReminderActive: !!(reminderDate && reminderTime),
  };
}

/**
 * Downloads text as a local .md file for direct dragging into Obsidian
 */
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
