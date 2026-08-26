import { generateFastHash } from "../utils/crypto";

export interface DailyNoteEntry {
  type: "task" | "log" | "note_link" | "metric_summary";
  content: string;
  time?: string;
  hash?: string;
}

export class DailyNotesService {
  /**
   * Generates the standard Daily Note file name for a given date.
   */
  public static getDailyNoteFilename(date: Date = new Date()): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Creates or safely appends an entry to a Daily Note with idempotency check.
   */
  public static appendStructuredEntry(
    existingContent: string,
    entry: DailyNoteEntry,
    dateStr: string = this.getDailyNoteFilename()
  ): { updatedContent: string; wasAppended: boolean } {
    const timeStr = entry.time || new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const entryHash = entry.hash || generateFastHash("log", entry.content);

    // If existing content is empty or lacks frontmatter, initialize fresh template
    let content = existingContent.trim();
    if (!content) {
      content = `---
id: "daily_${dateStr.replace(/-/g, "")}"
tipo: "Daily Note"
status: "OFICIAL"
owner: "Gestor de Marketing Nisti Print"
created_at: "${dateStr}"
updated_at: "${dateStr}"
confidencialidade: "Interno"
produto: "Linha Nisti Print"
nicho: "Papelaria & B2B"
canal: "Omnichannel"
projeto: "Operação Diária de Marketing"
tags:
  - daily
  - marketing-nisti
  - operacao
origem: "Nisti Marketing Hub"
approved_by: "Gestor de Marketing"
hash: "${generateFastHash("daily", dateStr)}"
---

# 📅 Daily Note - ${dateStr}

## 🎯 Foco & Prioridades do Dia
- [ ] Revisar métricas diárias e pipeline de conteúdo da Nisti Print

## ✅ Tarefas de Marketing (Obsidian Tasks)

## 📝 Log de Atividades & Auditoria

## 💡 Conhecimentos & Conexões
`;
    }

    // Check for idempotency: if entry content or hash is already in the document, don't duplicate
    const cleanContentMatch = entry.content.trim();
    if (content.includes(cleanContentMatch) || (entry.hash && content.includes(entry.hash))) {
      return { updatedContent: content, wasAppended: false };
    }

    // Append to the correct structured section
    if (entry.type === "task") {
      const taskSectionHeader = "## ✅ Tarefas de Marketing (Obsidian Tasks)";
      const formattedTask = entry.content.startsWith("- [ ]")
        ? entry.content
        : `- [ ] ${entry.content} 📅 ${dateStr} ⏰ ${timeStr} #marketing #nisti`;

      if (content.includes(taskSectionHeader)) {
        content = content.replace(
          taskSectionHeader,
          `${taskSectionHeader}\n${formattedTask}`
        );
      } else {
        content += `\n\n${taskSectionHeader}\n${formattedTask}`;
      }
    } else if (entry.type === "log" || entry.type === "metric_summary") {
      const logSectionHeader = "## 📝 Log de Atividades & Auditoria";
      const formattedLog = `- **[${timeStr}]**: ${entry.content} <!-- ${entryHash} -->`;

      if (content.includes(logSectionHeader)) {
        content = content.replace(
          logSectionHeader,
          `${logSectionHeader}\n${formattedLog}`
        );
      } else {
        content += `\n\n${logSectionHeader}\n${formattedLog}`;
      }
    } else if (entry.type === "note_link") {
      const linksSectionHeader = "## 💡 Conhecimentos & Conexões";
      const formattedLink = `- ${entry.content.startsWith("[[") ? entry.content : `[[${entry.content}]]`} (vinculado às ${timeStr})`;

      if (content.includes(linksSectionHeader)) {
        content = content.replace(
          linksSectionHeader,
          `${linksSectionHeader}\n${formattedLink}`
        );
      } else {
        content += `\n\n${linksSectionHeader}\n${formattedLink}`;
      }
    }

    return { updatedContent: content, wasAppended: true };
  }
}
