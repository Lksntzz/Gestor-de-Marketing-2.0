import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  BASE_FOLDER,
  BASE_ONBOARDING_SECTIONS,
  buildBaseDocumentPlans,
  canonicalBasePath,
  createEmptyBaseOnboardingDraft,
  type BaseOnboardingDraft,
} from "../src/domain/baseOnboarding";
import { writeCanonicalKnowledgeNote } from "../src/electron/knowledge/CanonicalKnowledgeWriter";
import { KnowledgeIndex } from "../src/services/knowledge/index/KnowledgeIndex";
import { VaultIndexer } from "../src/services/knowledge/index/VaultIndexer";
import type { ObsidianNote } from "../src/types";

function completeDraft(): BaseOnboardingDraft {
  const draft = createEmptyBaseOnboardingDraft(new Date("2026-08-29T00:00:00-03:00"));
  for (const section of BASE_ONBOARDING_SECTIONS) {
    for (const question of section.questions) {
      draft.answers[question.id] = {
        value: `Resposta confirmada para ${question.label}`,
        status: "CONFIRMADO",
      };
    }
  }
  return draft;
}

function existingNote(relativePath: string, content = "# Existente"): ObsidianNote {
  const title = path.basename(relativePath, ".md");
  const folder = path.dirname(relativePath).replace(/\\/g, "/");
  return {
    id: `existing-${title}`,
    path: relativePath.replace(/\\/g, "/"),
    title,
    folder,
    content,
    frontmatter: { epistemic_status: "CONFIRMADO" },
    tags: [],
    wikilinks: [],
    lastModified: "2026-08-29 00:00",
  };
}

async function indexVault(vaultPath: string, dbPath: string) {
  const index = new KnowledgeIndex(dbPath);
  const vaultId = crypto.createHash("sha256").update(vaultPath).digest("hex");
  const indexer = new VaultIndexer(index, vaultPath, vaultId);
  await indexer.sync();
  return { index, vaultId };
}

async function writePlans(vaultPath: string, plans: ReturnType<typeof buildBaseDocumentPlans>) {
  for (const plan of plans) {
    await writeCanonicalKnowledgeNote({
      vaultPath,
      folder: BASE_FOLDER,
      title: plan.title,
      content: plan.content,
      frontmatter: plan.frontmatter,
    });
  }
}

test("desktop onboarding: Vault vazio grava somente os 10 documentos canônicos e indexa todos", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "nisti-base-empty-"));
  const vaultPath = path.join(workspace, "Vault");
  const dbPath = path.join(workspace, "knowledge.sqlite");
  await mkdir(path.join(vaultPath, BASE_FOLDER), { recursive: true });

  let index: KnowledgeIndex | null = null;
  try {
    const plans = buildBaseDocumentPlans(completeDraft(), [], new Date(2026, 7, 29));
    assert.equal(plans.length, BASE_ONBOARDING_SECTIONS.length + 1);

    await writePlans(vaultPath, plans);

    const files = (await readdir(path.join(vaultPath, BASE_FOLDER))).sort();
    const expected = [
      ...BASE_ONBOARDING_SECTIONS.map((section) => `${section.fileTitle}.md`),
      "Pendencias.md",
    ].sort();
    assert.deepEqual(files, expected);
    assert.equal(files.some((name) => / \(\d+\)\.md$/i.test(name)), false);

    const empresa = await readFile(path.join(vaultPath, "00_Base", "Empresa.md"), "utf8");
    assert.match(empresa, /epistemic_status: "CONFIRMADO"/);
    assert.match(empresa, /status: "OFICIAL"/);
    assert.match(empresa, /# Empresa/);

    const indexed = await indexVault(vaultPath, dbPath);
    index = indexed.index;
    const docs = index.getDocumentsByVault(indexed.vaultId);
    const baseDocs = docs.filter((doc) => doc.relative_path.startsWith("00_Base/"));
    assert.equal(baseDocs.length, expected.length);
    assert.equal(baseDocs.every((doc) => doc.epistemic_status === "CONFIRMADO"), true);
    assert.equal(baseDocs.some((doc) => doc.relative_path === "00_Base/Empresa.md"), true);
  } finally {
    index?.close();
    await rm(workspace, { recursive: true, force: true });
  }
});

test("desktop onboarding: Vault parcial preserva canônico existente, cria apenas ausentes e falha fechado em corrida", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "nisti-base-partial-"));
  const vaultPath = path.join(workspace, "Vault");
  const basePath = path.join(vaultPath, BASE_FOLDER);
  const dbPath = path.join(workspace, "knowledge.sqlite");
  await mkdir(basePath, { recursive: true });

  const existingEmpresa = [
    "---",
    'epistemic_status: "CONFIRMADO"',
    'status: "OFICIAL"',
    "---",
    "",
    "# Empresa existente",
    "CONTEUDO_SENTINELA_NAO_SOBRESCREVER",
  ].join("\n");
  await writeFile(path.join(basePath, "Empresa.md"), existingEmpresa, { encoding: "utf8", flag: "wx" });

  let index: KnowledgeIndex | null = null;
  try {
    const existing = [existingNote("00_Base/Empresa.md", existingEmpresa)];
    const plans = buildBaseDocumentPlans(completeDraft(), existing, new Date(2026, 7, 29));
    assert.equal(plans.some((plan) => plan.path === canonicalBasePath(BASE_ONBOARDING_SECTIONS[0])), false);
    assert.equal(plans.length, BASE_ONBOARDING_SECTIONS.length);

    await writePlans(vaultPath, plans);

    const after = await readFile(path.join(basePath, "Empresa.md"), "utf8");
    assert.equal(after, existingEmpresa);
    const files = await readdir(basePath);
    assert.equal(files.includes("Empresa (2).md"), false);

    await assert.rejects(
      () => writeCanonicalKnowledgeNote({
        vaultPath,
        folder: BASE_FOLDER,
        title: "Empresa",
        content: "# Tentativa concorrente",
        frontmatter: { epistemic_status: "CONFIRMADO" },
      }),
      /já existe.*bloqueada.*duplicação/i,
    );

    const afterRejectedWrite = await readFile(path.join(basePath, "Empresa.md"), "utf8");
    assert.equal(afterRejectedWrite, existingEmpresa);

    const indexed = await indexVault(vaultPath, dbPath);
    index = indexed.index;
    const docs = index.getDocumentsByVault(indexed.vaultId);
    assert.equal(docs.filter((doc) => doc.relative_path.startsWith("00_Base/")).length, BASE_ONBOARDING_SECTIONS.length + 1);
    const empresaDoc = docs.find((doc) => doc.relative_path === "00_Base/Empresa.md");
    assert.ok(empresaDoc);
    assert.match(empresaDoc.content, /CONTEUDO_SENTINELA_NAO_SOBRESCREVER/);
  } finally {
    index?.close();
    await rm(workspace, { recursive: true, force: true });
  }
});

test("desktop onboarding: contrato renderer/main mantém failIfExists e escrita exclusiva", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const [panel, main, types] = await Promise.all([
    readFile(path.join(repoRoot, "src/components/BaseOnboardingPanel.tsx"), "utf8"),
    readFile(path.join(repoRoot, "electron-main.ts"), "utf8"),
    readFile(path.join(repoRoot, "src/types.ts"), "utf8"),
  ]);

  assert.match(panel, /failIfExists:\s*true/);
  assert.match(main, /payload\.failIfExists/);
  assert.match(main, /flag:\s*"wx"/);
  assert.match(main, /resolveUniqueVaultPath/);
  assert.match(main, /documento canônico .* já existe/i);
  assert.match(types, /failIfExists\?:\s*boolean/);
});
