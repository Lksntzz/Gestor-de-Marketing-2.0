import { describe, expect, it } from "bun:test";
import { extractTasksFromMarkdown } from "../src/domain/taskExtractor";

describe("Markdown task extraction integrity", () => {
  it("preserves missing priority as unspecified", () => {
    const [task] = extractTasksFromMarkdown(
      "- [ ] Revisar catálogo de produtos",
      "00_Base/Produtos.md",
      "Produtos",
    );

    expect(task.priority).toBe("unspecified");
    expect(task.dueDate).toBe("");
    expect(task.isReminderActive).toBe(false);
  });

  it("maps Obsidian priority markers without promoting medium to urgent", () => {
    const tasks = extractTasksFromMarkdown(
      [
        "- [ ] Urgente 🔺",
        "- [ ] Alta ⏫",
        "- [ ] Média 🔼",
        "- [ ] Baixa 🔽",
      ].join("\n"),
      "00_Inbox/Tarefas.md",
      "Tarefas",
    );

    expect(tasks.map((task) => task.priority)).toEqual([
      "urgent",
      "high",
      "medium",
      "low",
    ]);
  });
});
