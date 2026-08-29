type LegacyApi = {
  generateCampaign: (...args: any[]) => Promise<any>;
  extractTasks: (...args: any[]) => Promise<any>;
};

let installed = false;

/**
 * Compatibility barrier for legacy App handlers that still promote AI output
 * directly into MarketingTask objects.
 *
 * The current product requires human confirmation for operational metadata.
 * Until those old handlers are removed, generated/extracted task collections
 * are converted into review-only suggestions before they reach the renderer.
 */
export function installLegacyTaskImportGuard(api: LegacyApi): void {
  if (installed) return;
  installed = true;

  const generateCampaign = api.generateCampaign.bind(api);
  api.generateCampaign = async (...args: any[]) => {
    const result = await generateCampaign(...args);
    const tasks = Array.isArray(result?.data?.tasks) ? result.data.tasks : [];
    if (tasks.length === 0) return result;

    return {
      ...result,
      taskImportBlocked: true,
      data: {
        ...result.data,
        taskSuggestions: Array.isArray(result.data?.taskSuggestions)
          ? result.data.taskSuggestions
          : tasks,
        tasks: [],
      },
    };
  };

  const extractTasks = api.extractTasks.bind(api);
  api.extractTasks = async (...args: any[]) => {
    const result = await extractTasks(...args);
    const extractedTasks = Array.isArray(result?.data?.extractedTasks)
      ? result.data.extractedTasks
      : [];
    if (extractedTasks.length === 0) return result;

    return {
      ...result,
      taskImportBlocked: true,
      data: {
        ...result.data,
        reviewCandidates: Array.isArray(result.data?.reviewCandidates)
          ? result.data.reviewCandidates
          : extractedTasks,
        extractedTasks: undefined,
      },
    };
  };
}
