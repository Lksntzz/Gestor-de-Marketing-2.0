import { describe, expect, test } from "bun:test";
import type { CreativeScript, EditorialItem, IdeaItem } from "../src/types";
import {
  buildCreativeLibrary,
  creativeLibraryCounts,
  isScriptApproved,
} from "../src/domain/creativeLibrary";

function idea(overrides: Partial<IdeaItem> = {}): IdeaItem {
  return {
    id: "idea-1",
    title: "Bastidores",
    status: "ideia",
    targetPersona: "",
    hook: "Como fazemos",
    tags: [],
    ...overrides,
  };
}

function script(overrides: Partial<CreativeScript> = {}): CreativeScript {
  return {
    id: "script-1",
    title: "Roteiro Bastidores",
    type: "video_reels",
    durationOrSlides: "30s",
    objective: "Mostrar processo",
    targetAudience: "",
    hookScene: "Como fazemos",
    bodyScenes: [],
    callToAction: "Conheça",
    tags: [],
    platform: "Instagram",
    format: "Reel",
    sourceIdeaId: "idea-1",
    sourceIdeaTitle: "Bastidores",
    ...overrides,
  };
}

function editorial(overrides: Partial<EditorialItem> = {}): EditorialItem {
  return {
    id: "ed-1",
    title: "Roteiro Bastidores",
    contentType: "Reel",
    platform: "Instagram",
    objective: "Mostrar processo",
    scheduledDate: "2026-09-02",
    status: "SCHEDULED",
    priority: "medium",
    scriptId: "script-1",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("creative library", () => {
  test("não cria um novo estado persistido: deriva ideia e desenvolvimento dos registros existentes", () => {
    expect(buildCreativeLibrary([idea()], [], [])[0]?.status).toBe("idea");
    expect(buildCreativeLibrary([idea()], [script()], [])[0]?.status).toBe("development");
  });

  test("aprovação é explícita por tag de workflow e não altera o estado epistemológico", () => {
    const approved = script({ tags: ["workflow:approved"] });
    expect(isScriptApproved(approved)).toBe(true);
    expect(buildCreativeLibrary([idea()], [approved], [])[0]?.status).toBe("approved");
  });

  test("planejado é derivado do SQLite editorial vinculado por scriptId", () => {
    const entries = buildCreativeLibrary(
      [idea()],
      [script({ tags: ["workflow:approved"] })],
      [editorial()],
    );

    expect(entries[0]?.status).toBe("planned");
    expect(entries[0]?.plannedItem?.scheduledDate).toBe("2026-09-02");
  });

  test("item editorial arquivado não mantém conteúdo artificialmente como planejado", () => {
    const entries = buildCreativeLibrary(
      [idea()],
      [script({ tags: ["workflow:approved"] })],
      [editorial({ status: "ARCHIVED" })],
    );
    expect(entries[0]?.status).toBe("approved");
  });

  test("roteiro legado sem ideia continua visível sem ser promovido a aprovado", () => {
    const entries = buildCreativeLibrary([], [script({ sourceIdeaId: undefined })], []);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.status).toBe("development");
  });

  test("resume contagens operacionais sem métricas inventadas", () => {
    const entries = buildCreativeLibrary(
      [idea(), idea({ id: "idea-2", title: "Produto" })],
      [script({ tags: ["workflow:approved"] })],
      [],
    );
    expect(creativeLibraryCounts(entries)).toEqual({
      total: 2,
      idea: 1,
      development: 0,
      approved: 1,
      planned: 0,
    });
  });
});
