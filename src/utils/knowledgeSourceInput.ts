export type PrimaryKnowledgeSource = "file" | "link" | "text";
export type KnowledgeProcessorType = "pdf" | "image" | "youtube" | "site" | "text";

const SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"] as const;
const SUPPORTED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export function detectKnowledgeFileType(input: {
  name: string;
  mimeType?: string;
}): "pdf" | "image" | null {
  const fileName = String(input.name || "").trim().toLowerCase();
  const mimeType = String(input.mimeType || "").trim().toLowerCase();

  if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) return "pdf";
  if (
    SUPPORTED_IMAGE_MIME_TYPES.some((supported) => supported === mimeType) ||
    SUPPORTED_IMAGE_EXTENSIONS.some((extension) => fileName.endsWith(extension))
  ) {
    return "image";
  }

  return null;
}

export function detectKnowledgeLinkType(value: string): "youtube" | "site" {
  const raw = String(value || "").trim();
  if (!raw) return "site";

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtu.be" ||
      host.endsWith(".youtu.be")
    ) {
      return "youtube";
    }
  } catch {
    const normalized = raw.toLowerCase();
    if (normalized.includes("youtube.com/") || normalized.includes("youtu.be/")) return "youtube";
  }

  return "site";
}

export function isSupportedKnowledgeLink(value: string): boolean {
  try {
    const parsed = new URL(String(value || "").trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
