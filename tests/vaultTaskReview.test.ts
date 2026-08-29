import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { extractLocalTasksFromNote } from "../src/utils/localEngine";

describe("vault task review", () => {
  test("revisão mostra somente tarefas explícitas e não promove candidato para execução", () => {
    const result = extractLocalTasksFromNote({
      noteTitle: "Checklist real",
      noteContent: [
        "Texto comum que não é tarefa.",
        "- [ ] Revisar prova 📅 2026-09-04 ⏰ 10:30 ⏫ #producao",
        "- [ ] Confirmar material",
      ].join("\n"),
    });

    expect(result.extractedTasks).toBeUndefined();
    expect(result.reviewCandidates).toHaveLength(2);
    expect(result.reviewCandidates[0]).toMatchObject({
      title: "Revisar prova",
      dueDate: "2026-09-04",
      dueTime: "10:30",
      priority: "high",
    });
    expect(result.reviewCandidates[1].priority).toBeUndefined();
    expect(result.reviewCandidates[1].dueDate).toBeUndefined();
  });

  test("Cofre usa revisão local e não chama o importador legado", async () => {
    const source = await readFile(new URL("../src/components/VaultView.tsx", import.meta.url), "utf8");
    expect(source).toContain("Revisar tarefas");
    expect(source).toContain("Revisão segura");
    expect(source).toContain("Nenhuma tarefa é criada automaticamente");
    expect(source).toContain("extractLocalTasksFromNote");
    expect(source).toContain("reviewCandidates");
    expect(source).not.toContain("onExtractTasksFromNote(current)");
    expect(source).not.toContain("Extrair tarefas");
  });
});
