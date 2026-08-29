import type { CreativeScript, EditorialItem, IdeaItem } from "../types";

export type CreativeLibraryStatus = "idea" | "development" | "approved" | "planned";

export interface CreativeLibraryEntry {
  id: string;
  title: string;
  status: CreativeLibraryStatus;
  idea?: IdeaItem;
  script?: CreativeScript;
  plannedItem?: EditorialItem;
}

const APPROVED_TAG = "workflow:approved";

export function isScriptApproved(script: CreativeScript): boolean {
  return script.tags.some((tag) => tag.trim().toLowerCase() === APPROVED_TAG);
}

function activeEditorialItems(items: EditorialItem[]): EditorialItem[] {
  return items.filter((item) => item.status !== "ARCHIVED");
}

export function buildCreativeLibrary(
  ideas: IdeaItem[],
  scripts: CreativeScript[],
  editorialItems: EditorialItem[],
): CreativeLibraryEntry[] {
  const activeEditorial = activeEditorialItems(editorialItems);
  const editorialByScript = new Map<string, EditorialItem>();
  for (const item of activeEditorial) {
    if (item.scriptId && !editorialByScript.has(item.scriptId)) {
      editorialByScript.set(item.scriptId, item);
    }
  }

  const ideaIds = new Set(ideas.map((idea) => idea.id));
  const entries: CreativeLibraryEntry[] = [];

  for (const idea of ideas) {
    if (idea.status === "arquivado") continue;

    const linkedScripts = scripts.filter((script) => script.sourceIdeaId === idea.id);
    const plannedScript = linkedScripts.find((script) => editorialByScript.has(script.id));
    const script = plannedScript || linkedScripts[0];
    const plannedItem = script ? editorialByScript.get(script.id) : undefined;

    let status: CreativeLibraryStatus = "idea";
    if (plannedItem) status = "planned";
    else if ((script && isScriptApproved(script)) || idea.status === "validado") status = "approved";
    else if (script || idea.status === "em-producao") status = "development";

    entries.push({
      id: `idea:${idea.id}`,
      title: script?.title || idea.title,
      status,
      idea,
      script,
      plannedItem,
    });
  }

  for (const script of scripts) {
    if (script.sourceIdeaId && ideaIds.has(script.sourceIdeaId)) continue;

    const plannedItem = editorialByScript.get(script.id);
    entries.push({
      id: `script:${script.id}`,
      title: script.title,
      status: plannedItem ? "planned" : isScriptApproved(script) ? "approved" : "development",
      script,
      plannedItem,
    });
  }

  const order: Record<CreativeLibraryStatus, number> = {
    development: 0,
    approved: 1,
    idea: 2,
    planned: 3,
  };

  return entries.sort((a, b) => order[a.status] - order[b.status]);
}

export function creativeLibraryCounts(entries: CreativeLibraryEntry[]) {
  return entries.reduce(
    (counts, entry) => {
      counts.total += 1;
      counts[entry.status] += 1;
      return counts;
    },
    { total: 0, idea: 0, development: 0, approved: 0, planned: 0 },
  );
}
