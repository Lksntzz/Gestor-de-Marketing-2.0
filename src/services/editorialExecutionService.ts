import type { EditorialItem, MarketingTask } from "../types";
import { editorialIdFromTask } from "../utils/executionIntelligence";

export const editorialExecutionService = {
  async markTaskPublished(task: MarketingTask): Promise<EditorialItem> {
    const editorialId = editorialIdFromTask(task);
    if (!editorialId) {
      throw new Error("A tarefa informada não está vinculada ao Calendário Editorial.");
    }
    if (!window.electronAPI?.editorialList || !window.electronAPI?.editorialUpsert) {
      throw new Error("A publicação editorial exige o runtime desktop para atualizar o calendário.");
    }

    const items = await window.electronAPI.editorialList();
    const current = Array.isArray(items)
      ? items.find((item) => item.id === editorialId)
      : undefined;

    if (!current) {
      throw new Error("O item editorial vinculado não foi encontrado. A tarefa não foi alterada.");
    }
    if (current.status === "ARCHIVED") {
      throw new Error("O item editorial está arquivado e não pode ser marcado como publicado pela Execução.");
    }
    if (current.status === "PUBLISHED") return current;

    const published: EditorialItem = {
      ...current,
      status: "PUBLISHED",
      updatedAt: Date.now(),
    };

    const result = await window.electronAPI.editorialUpsert(published);
    if (!result?.success) {
      throw new Error("O banco editorial não confirmou a publicação. A tarefa não foi alterada.");
    }

    return published;
  },
};
