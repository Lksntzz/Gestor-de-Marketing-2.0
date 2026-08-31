import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { OFFICIAL_TAXONOMY_FOLDERS, TAXONOMY_METADATA } from "../../domain/taxonomy";
import {
  VAULT_SCHEMA_VERSION,
  VaultAuditResult,
  VaultManifest,
  VaultManifestSchema,
} from "../../domain/vaultManifest";
import {
  OFFICIAL_VAULT_TEMPLATES,
  renderVaultTemplateFileContent,
} from "./VaultTemplateDefinitions";

export const NISTI_DOT_FOLDER = ".nisti";
export const VAULT_MANIFEST_FILENAME = "vault-manifest.json";

export interface VaultBootstrapOptions {
  vaultPath: string;
  vaultName?: string;
  forceRepair?: boolean;
}

export class VaultBootstrapService {
  /**
   * Generates the canonical manifest object
   */
  public static buildCanonicalManifest(vaultName: string, initializedAt?: string): VaultManifest {
    const now = new Date().toISOString();
    return {
      schemaVersion: VAULT_SCHEMA_VERSION,
      vaultName: vaultName || "MarketingVault",
      managedBy: "nisti-marketing-hub",
      initializedAt: initializedAt || now,
      lastAuditedAt: now,
      folders: OFFICIAL_TAXONOMY_FOLDERS.map((f) => ({
        name: f,
        description: TAXONOMY_METADATA[f]?.description || "",
        required: true,
      })),
      templates: OFFICIAL_VAULT_TEMPLATES.map((t) => ({
        id: t.id,
        filename: t.filename,
        title: t.title,
        type: t.type,
        targetFolder: t.targetFolder,
        version: t.version,
      })),
      systemMetadata: {
        generator: "Nisti Print PKM Marketing Hub",
        author: "Gestor de Marketing Nisti Print",
      },
    };
  }

  /**
   * Runs an integrity audit on the given vault path, checking directories, manifest, and templates.
   */
  public static async auditVault(vaultPath: string): Promise<VaultAuditResult> {
    const resolvedVault = path.resolve(vaultPath);
    if (!existsSync(resolvedVault)) {
      throw new Error(`Vault não encontrado no caminho: ${vaultPath}`);
    }

    const missingFolders: string[] = [];
    const missingTemplates: string[] = [];
    const warnings: string[] = [];

    // 1. Check official taxonomy folders
    for (const folder of OFFICIAL_TAXONOMY_FOLDERS) {
      const targetDir = path.join(resolvedVault, folder);
      if (!existsSync(targetDir)) {
        missingFolders.push(folder);
      }
    }

    // 2. Check 99_Templates templates
    const templatesDir = path.join(resolvedVault, "99_Templates");
    if (existsSync(templatesDir)) {
      for (const tpl of OFFICIAL_VAULT_TEMPLATES) {
        const tplFile = path.join(templatesDir, tpl.filename);
        if (!existsSync(tplFile)) {
          missingTemplates.push(tpl.filename);
        }
      }
    } else {
      missingTemplates.push(...OFFICIAL_VAULT_TEMPLATES.map((t) => t.filename));
    }

    // 3. Check .nisti/vault-manifest.json
    const dotNistiDir = path.join(resolvedVault, NISTI_DOT_FOLDER);
    const manifestFile = path.join(dotNistiDir, VAULT_MANIFEST_FILENAME);
    let manifestPresent = false;
    let manifestVersion: string | null = null;

    if (existsSync(manifestFile)) {
      try {
        const content = await fs.readFile(manifestFile, "utf8");
        const parsed = JSON.parse(content);
        manifestPresent = true;
        manifestVersion = parsed.schemaVersion || null;
        if (manifestVersion !== VAULT_SCHEMA_VERSION) {
          warnings.push(`Versão do manifesto (${manifestVersion}) difere da versão canônica (${VAULT_SCHEMA_VERSION}).`);
        }
      } catch (err: any) {
        warnings.push(`Manifesto .nisti/vault-manifest.json corrompido: ${err?.message || err}`);
      }
    } else {
      warnings.push("Manifesto canônico .nisti/vault-manifest.json ausente.");
    }

    // 4. Count total markdown notes
    let totalNotesFound = 0;
    try {
      totalNotesFound = await this.countVaultNotes(resolvedVault);
    } catch {
      // Non-fatal
    }

    const isValid = missingFolders.length === 0 && missingTemplates.length === 0 && manifestPresent;

    return {
      isValid,
      manifestPresent,
      manifestVersion,
      missingFolders,
      missingTemplates,
      repairedFolders: [],
      repairedTemplates: [],
      totalNotesFound,
      warnings,
    };
  }

  /**
   * Initializes or repairs the official structure without loss of existing user notes.
   */
  public static async bootstrapOrRepairVault(options: VaultBootstrapOptions): Promise<{
    success: boolean;
    vaultPath: string;
    vaultName: string;
    audit: VaultAuditResult;
    repairedFolders: string[];
    repairedTemplates: string[];
    manifestCreatedOrUpdated: boolean;
  }> {
    const resolvedVault = path.resolve(options.vaultPath);
    if (!existsSync(resolvedVault)) {
      await fs.mkdir(resolvedVault, { recursive: true });
    }

    const pathSegments = resolvedVault.replace(/\\/g, "/").split("/").filter(Boolean);
    const vaultName = options.vaultName || pathSegments.pop() || "MarketingVault";

    const initialAudit = await this.auditVault(resolvedVault);
    const repairedFolders: string[] = [];
    const repairedTemplates: string[] = [];

    // 1. Create missing official folders
    for (const folder of OFFICIAL_TAXONOMY_FOLDERS) {
      const folderPath = path.join(resolvedVault, folder);
      if (!existsSync(folderPath)) {
        await fs.mkdir(folderPath, { recursive: true });
        repairedFolders.push(folder);
      }
    }

    // 2. Ensure .nisti hidden folder
    const dotNistiDir = path.join(resolvedVault, NISTI_DOT_FOLDER);
    if (!existsSync(dotNistiDir)) {
      await fs.mkdir(dotNistiDir, { recursive: true });
    }

    // 3. Write / Update templates in 99_Templates
    const templatesDir = path.join(resolvedVault, "99_Templates");
    for (const tpl of OFFICIAL_VAULT_TEMPLATES) {
      const tplPath = path.join(templatesDir, tpl.filename);
      if (!existsSync(tplPath) || options.forceRepair) {
        const fileContent = renderVaultTemplateFileContent(tpl);
        await fs.writeFile(tplPath, fileContent, { encoding: "utf8" });
        repairedTemplates.push(tpl.filename);
      }
    }

    // 4. Create or update vault-manifest.json
    const manifestFile = path.join(dotNistiDir, VAULT_MANIFEST_FILENAME);
    let initializedAt = new Date().toISOString();
    if (existsSync(manifestFile)) {
      try {
        const existing = JSON.parse(await fs.readFile(manifestFile, "utf8"));
        if (existing.initializedAt) initializedAt = existing.initializedAt;
      } catch {
        // Keep fallback
      }
    }

    const manifestObj = this.buildCanonicalManifest(vaultName, initializedAt);
    await fs.writeFile(manifestFile, JSON.stringify(manifestObj, null, 2), { encoding: "utf8" });

    // 5. Final audit post-repair
    const postAudit = await this.auditVault(resolvedVault);
    postAudit.repairedFolders = repairedFolders;
    postAudit.repairedTemplates = repairedTemplates;

    return {
      success: true,
      vaultPath: resolvedVault,
      vaultName,
      audit: postAudit,
      repairedFolders,
      repairedTemplates,
      manifestCreatedOrUpdated: true,
    };
  }

  /**
   * Helper to scan and count all .md notes across the official folders
   */
  private static async countVaultNotes(vaultRoot: string): Promise<number> {
    let count = 0;
    for (const folder of OFFICIAL_TAXONOMY_FOLDERS) {
      const folderPath = path.join(vaultRoot, folder);
      if (!existsSync(folderPath)) continue;
      try {
        const entries = await fs.readdir(folderPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && entry.name.endsWith(".md")) {
            count++;
          }
        }
      } catch {
        // Skip unreadable folder
      }
    }
    return count;
  }
}
