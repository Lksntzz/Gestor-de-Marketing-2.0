import React from "react";
import type {
  AutomationRule,
  MarketingTask,
  ObsidianApiConfig,
} from "../types";
import { editorialExecutionService } from "../services/editorialExecutionService";
import { reconcileEditorialTask } from "../utils/editorialWorkflow";
import { ExecutionTasksView } from "./ExecutionTasksView";
import { LegacyAutomationsView } from "./LegacyAutomationsView";

interface TasksAutomationViewProps {
  tasks: MarketingTask[];
  automationRules: AutomationRule[];
  onToggleTaskStatus: (taskId: string) => void;
  onUpdateTask?: (task: MarketingTask) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenNewTaskModal: () => void;
  onPublishEditorialTask?: (taskId: string) => Promise<void>;
  onOpenPlanning?: () => void;
  onExtractTasksFromVault?: () => Promise<number | void>;
  onToggleRule: (ruleId: string) => void;
  onRunRuleNow: (ruleId: string) => void;
  onSyncDailyNote: () => void;
  apiConfig: ObsidianApiConfig;
  isSyncingDaily: boolean;
  initialSection?: "tasks" | "automations";
}

/**
 * Transitional compatibility shell.
 *
 * The product-facing execution flow is now intentionally isolated from the
 * legacy automation workspace. The `automations` route remains available only
 * while persisted rules are migrated/deprecated; it is not part of primary
 * navigation.
 */
export const TasksAutomationView: React.FC<TasksAutomationViewProps> = ({
  tasks = [],
  automationRules = [],
  onToggleTaskStatus,
  onUpdateTask,
  onDeleteTask,
  onOpenNewTaskModal,
  onPublishEditorialTask,
  onOpenPlanning,
  onExtractTasksFromVault,
  apiConfig,
  initialSection = "tasks",
}) => {
  if (initialSection === "automations") {
    return (
      <LegacyAutomationsView
        tasks={tasks}
        automationRules={automationRules}
        apiConfig={apiConfig}
      />
    );
  }

  const publishEditorialTask = async (taskId: string) => {
    if (onPublishEditorialTask) {
      await onPublishEditorialTask(taskId);
      return;
    }

    const task = tasks.find((item) => item.id === taskId);
    if (!task) throw new Error("A tarefa editorial não foi encontrada na fila de execução.");
    if (!onUpdateTask) throw new Error("A fila de execução não permite atualizar a tarefa reconciliada.");

    const publishedItem = await editorialExecutionService.markTaskPublished(task);
    const [reconciled] = reconcileEditorialTask([task], publishedItem);
    if (!reconciled) throw new Error("A tarefa editorial não pôde ser reconciliada após a publicação.");
    onUpdateTask(reconciled);
  };

  return (
    <ExecutionTasksView
      tasks={tasks}
      onToggleTaskStatus={onToggleTaskStatus}
      onUpdateTask={onUpdateTask}
      onDeleteTask={onDeleteTask}
      onOpenNewTaskModal={onOpenNewTaskModal}
      onPublishEditorialTask={publishEditorialTask}
      onOpenPlanning={onOpenPlanning}
      onExtractTasksFromVault={onExtractTasksFromVault}
      apiConfig={apiConfig}
    />
  );
};
