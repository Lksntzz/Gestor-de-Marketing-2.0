import {
  buildWorkspaceBackup,
  parseWorkspaceImport,
  type WorkspaceBackupInput,
  type WorkspaceImport,
} from "./appStateSchemas";

export interface WorkspaceRestorePlan {
  version?: string;
  formatVersion?: 1 | 2;
  exportedAt?: string;
  notes: WorkspaceImport["notes"];
  campaigns: WorkspaceImport["campaigns"];
  tasks: WorkspaceImport["tasks"];
  automationRules?: WorkspaceImport["automationRules"];
  ideas?: WorkspaceImport["ideas"];
  scripts?: WorkspaceImport["scripts"];
  visuals?: WorkspaceImport["visuals"];
  emotionalDrivers?: WorkspaceImport["emotionalDrivers"];
  niches?: WorkspaceImport["niches"];
  postHistory?: WorkspaceImport["postHistory"];
  learnings?: WorkspaceImport["learnings"];
  weeklyRoutine?: WorkspaceImport["weeklyRoutine"];
  engineMode?: WorkspaceImport["engineMode"];
  editorialItems?: WorkspaceImport["editorialItems"];
  apiConfig?: WorkspaceImport["apiConfig"];
}

export function serializeWorkspaceBackup(input: WorkspaceBackupInput): string {
  return JSON.stringify(buildWorkspaceBackup(input), null, 2);
}

export function createWorkspaceRestorePlan(input: unknown): WorkspaceRestorePlan {
  const parsed = parseWorkspaceImport(input);
  return {
    version: parsed.version,
    formatVersion: parsed.formatVersion,
    exportedAt: parsed.exportedAt,
    notes: parsed.notes,
    campaigns: parsed.campaigns,
    tasks: parsed.tasks,
    automationRules: parsed.automationRules,
    ideas: parsed.ideas,
    scripts: parsed.scripts,
    visuals: parsed.visuals,
    emotionalDrivers: parsed.emotionalDrivers,
    niches: parsed.niches,
    postHistory: parsed.postHistory,
    learnings: parsed.learnings,
    weeklyRoutine: parsed.weeklyRoutine,
    engineMode: parsed.engineMode,
    editorialItems: parsed.editorialItems,
    apiConfig: parsed.apiConfig,
  };
}

export function parseWorkspaceBackupText(jsonText: string): WorkspaceRestorePlan {
  const parsedJson = JSON.parse(jsonText) as unknown;
  return createWorkspaceRestorePlan(parsedJson);
}
