import type { MarketingTask, ObsidianNote, TaskPriority } from "../types";
import { formatToObsidianTask } from "../utils/obsidianUri";

export interface ExtractedTaskResult {
  tasks: MarketingTask[];
  sourcePath: string;
  sourceTitle: string;
}

/**
 * Parses markdown tasks formatted as:
 * - [ ] Tarefa 📅 2026-09-05 ⏰ 14:00 🔺 🏷️ #tag
 * - [x] Tarefa concluída
 */
export function extractTasksFromMarkdown(content: string, sourcePath: string, sourceTitle: string): MarketingTask[] {
  const lines = content.split("\n");
  const extracted: MarketingTask[] = [];

  const taskRegex = /^\s*-\s*\[([ xX])\]\s+(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(taskRegex);
    if (!match) continue;

    const isDone = match[1].toLowerCase() === "x";
    let body = match[2].trim();

    // Priority detection
    let priority: TaskPriority = "unspecified";
    if (body.includes("🔺") || body.toLowerCase().includes("#urgente")) {
      priority = "urgent";
    } else if (body.includes("⏫") || body.toLowerCase().includes("#alta")) {
      priority = "high";
    } else if (body.includes("🔼") || body.toLowerCase().includes("#media") || body.toLowerCase().includes("#média")) {
      priority = "medium";
    } else if (body.includes("🔽") || body.toLowerCase().includes("#baixa")) {
      priority = "low";
    }

    // Due date detection 📅 YYYY-MM-DD
    let dueDate: string | undefined;
    const dueMatch = body.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
    if (dueMatch) {
      dueDate = dueMatch[1];
    }

    // Due time detection ⏰ HH:MM
    let dueTime: string | undefined;
    const timeMatch = body.match(/⏰\s*(\d{2}:\d{2})/);
    if (timeMatch) {
      dueTime = timeMatch[1];
    }

    // Clean emojis and markers from task title
    const cleanTitle = body
      .replace(/📅\s*\d{4}-\d{2}-\d{2}/g, "")
      .replace(/⏰\s*\d{2}:\d{2}/g, "")
      .replace(/[🔺🔼⏫🔽]/g, "")
      .replace(/#\w+/g, "")
      .trim();

    // Tags extraction
    const tags = (body.match(/#([a-zA-Z0-9_\-]+)/g) || []).map((t) => t.replace("#", ""));

    const taskId = `task-extracted-${sourcePath.replace(/[^a-zA-Z0-9]/g, "-")}-${i}`;

    const task: MarketingTask = {
      id: taskId,
      title: cleanTitle || "Tarefa sem título",
      status: isDone ? "done" : "todo",
      priority,
      dueDate: dueDate || "",
      dueTime,
      obsidianFilePath: sourcePath,
      tags,
      isReminderActive: false,
      obsidianTaskString: line.trim(),
    };

    extracted.push(task);
  }

  return extracted;
}

/**
 * Scans all notes in vault for operational tasks
 */
export function extractAllTasksFromNotes(notes: ObsidianNote[]): MarketingTask[] {
  const allTasks: MarketingTask[] = [];
  for (const note of notes) {
    if (!note.content) continue;
    const tasks = extractTasksFromMarkdown(note.content, note.path, note.title);
    allTasks.push(...tasks);
  }
  return allTasks;
}
