import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { generateLocalCampaign, extractLocalTasksFromNote } from "../src/utils/localEngine";
import { parseObsidianTaskString } from "../src/utils/obsidianUri";
import { installLegacyTaskImportGuard } from "../src/services/legacyTaskImportGuard";

describe("legacy task default hardening", () => {
  test("parser do Obsidian preserva metadados ausentes em vez de inventar hoje ou prioridade média", () => {
    const parsed = parseObsidianTaskString("- [ ] Revisar pauta #marketing", "task-1");

    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe("Revisar pauta");
    expect(parsed?.dueDate).toBeUndefined();
    expect(parsed?.dueTime).toBeUndefined();
    expect(parsed?.priority).toBeUndefined();
    expect(parsed?.reminderDate).toBeUndefined();
    expect(parsed?.reminderTime).toBeUndefined();
    expect(parsed?.isReminderActive).toBe(false);
  });

  test("parser preserva somente metadados operacionais explicitamente codificados", () => {
    const parsed = parseObsidianTaskString(
      "- [ ] Publicar case 📅 2026-09-01 ⏰ 14:30 (@2026-09-01 13:30) ⏫ #marketing",
      "task-2",
    );

    expect(parsed?.title).toBe("Publicar case");
    expect(parsed?.dueDate).toBe("2026-09-01");
    expect(parsed?.dueTime).toBe("14:30");
    expect(parsed?.priority).toBe("high");
    expect(parsed?.reminderDate).toBe("2026-09-01");
    expect(parsed?.reminderTime).toBe("13:30");
    expect(parsed?.isReminderActive).toBe(true);
  });

  test("motor local mantém checklist de campanha fora da fila de execução", () => {
    const result = generateLocalCampaign({
      campaignName: "Campanha segura",
      objective: "Apresentar processo",
      channels: ["Instagram"],
      audience: "Clientes atuais",
      tone: "Objetivo",
      contextNotesList: [],
    });

    expect(result.tasks).toEqual([]);
    expect(result.taskSuggestions.length).toBeGreaterThan(0);
    expect(result.obsidianMarkdownNote).toContain("Checklist sugerido — requer registro humano antes de virar tarefa");
    for (const suggestion of result.taskSuggestions) {
      expect(suggestion).not.toContain("📅");
      expect(suggestion).not.toContain("⏰");
      expect(suggestion).not.toContain("🔺");
      expect(suggestion).not.toContain("⏫");
      expect(suggestion).not.toContain("🔼");
      expect(suggestion).not.toContain("🔽");
    }
  });

  test("extração local devolve candidatos para revisão sem criar MarketingTask", () => {
    const result = extractLocalTasksFromNote({
      noteTitle: "Fonte",
      noteContent: "- [ ] Revisar pauta\n- [ ] Publicar 📅 2026-09-03 ⏫",
    });

    expect(result.extractedTasks).toBeUndefined();
    expect(result.suggestedReminders).toEqual([]);
    expect(result.reviewCandidates).toHaveLength(2);
    expect(result.reviewCandidates[0]?.priority).toBeUndefined();
    expect(result.reviewCandidates[0]?.dueDate).toBeUndefined();
    expect(result.reviewCandidates[1]?.priority).toBe("high");
    expect(result.reviewCandidates[1]?.dueDate).toBe("2026-09-03");
  });

  test("barreira de compatibilidade sanitiza tarefas retornadas pela IA antes do App legado", async () => {
    const mockApi: any = {
      generateCampaign: async () => ({
        success: true,
        data: { summary: "Campanha", tasks: [{ title: "Tarefa sugerida" }] },
      }),
      extractTasks: async () => ({
        success: true,
        data: { extractedTasks: [{ title: "Tarefa extraída" }] },
      }),
    };

    installLegacyTaskImportGuard(mockApi);

    const campaign = await mockApi.generateCampaign();
    expect(campaign.taskImportBlocked).toBe(true);
    expect(campaign.data.tasks).toEqual([]);
    expect(campaign.data.taskSuggestions).toEqual([{ title: "Tarefa sugerida" }]);

    const extraction = await mockApi.extractTasks();
    expect(extraction.taskImportBlocked).toBe(true);
    expect(extraction.data.extractedTasks).toBeUndefined();
    expect(extraction.data.reviewCandidates).toEqual([{ title: "Tarefa extraída" }]);
  });

  test("barreira é instalada antes do render da aplicação", async () => {
    const main = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
    const installIndex = main.indexOf("installLegacyTaskImportGuard(api)");
    const renderIndex = main.indexOf("createRoot(");

    expect(installIndex).toBeGreaterThan(-1);
    expect(renderIndex).toBeGreaterThan(installIndex);
  });
});
