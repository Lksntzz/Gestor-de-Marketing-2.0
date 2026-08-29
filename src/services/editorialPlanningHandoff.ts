export interface EditorialPlanningHandoff {
  scriptId: string;
  scheduledDate?: string;
  scheduledTime?: string;
}

const HANDOFF_KEY = "nisti.editorialPlanningHandoff.v1";

function clean(value: unknown): string | undefined {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || undefined;
}

export function storeEditorialPlanningHandoff(input: EditorialPlanningHandoff): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;

  const scriptId = clean(input.scriptId);
  if (!scriptId) throw new Error("O planejamento exige um roteiro aprovado identificado explicitamente.");

  const payload: EditorialPlanningHandoff = {
    scriptId,
    scheduledDate: clean(input.scheduledDate),
    scheduledTime: clean(input.scheduledTime),
  };

  window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(payload));
}

export function consumeEditorialPlanningHandoff(): EditorialPlanningHandoff | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;

  const raw = window.sessionStorage.getItem(HANDOFF_KEY);
  if (!raw) return null;

  window.sessionStorage.removeItem(HANDOFF_KEY);

  try {
    const parsed = JSON.parse(raw) as Partial<EditorialPlanningHandoff>;
    const scriptId = clean(parsed.scriptId);
    if (!scriptId) return null;

    return {
      scriptId,
      scheduledDate: clean(parsed.scheduledDate),
      scheduledTime: clean(parsed.scheduledTime),
    };
  } catch {
    return null;
  }
}
