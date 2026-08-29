import React from "react";
import type {
  AutomationRule,
  MarketingTask,
  ObsidianApiConfig,
} from "../types";
import { ExecutionTasksView } from "./ExecutionTasksView";
import { LegacyAutomationsView } from "./LegacyAutomationsView";

interface TasksAutomationViewProps {
  tasks: MarketingTask[];
  automationRules: AutomationRule[];
  onToggleTaskStatus: (taskId: string) => void;
  onUpdateTask?: (task: MarketingTask) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenNewTaskModal: () => void;
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

  return (
    <ExecutionTasksView
      tasks={tasks}
      onToggleTaskStatus={onToggleTaskStatus}
      onUpdateTask={onUpdateTask}
      onDeleteTask={onDeleteTask}
      onOpenNewTaskModal={onOpenNewTaskModal}
      apiConfig={apiConfig}
    />
  );
};
