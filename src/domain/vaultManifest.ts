import { z } from "zod";
import { OFFICIAL_TAXONOMY_FOLDERS } from "./taxonomy";

export const VAULT_SCHEMA_VERSION = "2.2.0";

export const VaultManifestFolderSchema = z.object({
  name: z.string(),
  description: z.string(),
  required: z.boolean().default(true),
});

export const VaultManifestTemplateSchema = z.object({
  id: z.string(),
  filename: z.string(),
  title: z.string(),
  type: z.string(),
  targetFolder: z.string(),
  version: z.string(),
});

export const VaultManifestSchema = z.object({
  schemaVersion: z.string().default(VAULT_SCHEMA_VERSION),
  vaultName: z.string(),
  managedBy: z.literal("nisti-marketing-hub"),
  initializedAt: z.string(),
  lastAuditedAt: z.string(),
  folders: z.array(VaultManifestFolderSchema),
  templates: z.array(VaultManifestTemplateSchema),
  systemMetadata: z.object({
    generator: z.string(),
    author: z.string(),
  }),
});

export type VaultManifest = z.infer<typeof VaultManifestSchema>;

export interface VaultAuditResult {
  isValid: boolean;
  manifestPresent: boolean;
  manifestVersion: string | null;
  missingFolders: string[];
  missingTemplates: string[];
  repairedFolders: string[];
  repairedTemplates: string[];
  totalNotesFound: number;
  warnings: string[];
}
