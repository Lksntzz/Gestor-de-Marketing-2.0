import {
  NISTI_KNOWLEDGE_FOLDERS,
  NISTI_RELATIVE_FOLDERS,
  NISTI_VAULT_ROOT,
} from "./obsidianKnowledgeAutomation";

function normalizeRoot(value: string): string {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/")
    .trim();
}

const directRoots = [...NISTI_RELATIVE_FOLDERS].map(String);
const legacyRoots = [...NISTI_KNOWLEDGE_FOLDERS].map(String);

export const MANAGED_OBSIDIAN_SCAN_ROOTS = Array.from(
  new Set([...directRoots, ...legacyRoots].map(normalizeRoot).filter(Boolean)),
);

const MANAGED_ROOT_PREFIXES = MANAGED_OBSIDIAN_SCAN_ROOTS.map((root) => `${root}/`.toLowerCase());

export function isManagedObsidianRoot(value: string): boolean {
  const clean = normalizeRoot(value);
  if (!clean) return false;
  const lower = clean.toLowerCase();
  return MANAGED_OBSIDIAN_SCAN_ROOTS.some((root) => root.toLowerCase() === lower)
    || MANAGED_ROOT_PREFIXES.some((prefix) => `${lower}/`.startsWith(prefix));
}

export function sanitizeManagedObsidianRoots(roots?: string[]): string[] {
  if (!Array.isArray(roots) || roots.length === 0) {
    return [...MANAGED_OBSIDIAN_SCAN_ROOTS];
  }

  const safe = Array.from(
    new Set(
      roots
        .map(normalizeRoot)
        .filter((root) => root && isManagedObsidianRoot(root)),
    ),
  );

  return safe.length ? safe : [...MANAGED_OBSIDIAN_SCAN_ROOTS];
}

export function isManagedObsidianPath(value: string): boolean {
  const clean = normalizeRoot(value).replace(/^vault\//i, "");
  if (!clean) return false;
  const directAllowed = directRoots.some((root) => {
    const lowerRoot = root.toLowerCase();
    const lower = clean.toLowerCase();
    return lower === lowerRoot || lower.startsWith(`${lowerRoot}/`);
  });
  if (directAllowed) return true;

  const legacyPrefix = `${NISTI_VAULT_ROOT}/`.toLowerCase();
  if (!clean.toLowerCase().startsWith(legacyPrefix)) return false;
  const relative = clean.slice(legacyPrefix.length);
  return directRoots.some((root) => {
    const lowerRoot = root.toLowerCase();
    const lower = relative.toLowerCase();
    return lower === lowerRoot || lower.startsWith(`${lowerRoot}/`);
  });
}
