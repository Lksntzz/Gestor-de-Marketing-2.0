/**
 * Cryptographic and Idempotency Utilities
 */

/**
 * Computes a SHA-256 hash of a string using Web Crypto API or simple polynomial hash in fallback.
 */
export async function sha256(content: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(content);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // Fallback
    }
  }

  // Pure deterministic string hash fallback
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `hash_${Math.abs(hash).toString(16).padStart(8, "0")}_${content.length}`;
}

/**
 * Synchronous hash generator for instant frontmatter calculation.
 */
export function generateFastHash(prefix: string, content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4) || "np";
  return `${cleanPrefix}_${Math.abs(hash).toString(36)}_${Date.now().toString(36).slice(-4)}`;
}

/**
 * Generates a unique UUID v4.
 */
export function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Masks sensitive API tokens, preventing secret leaks in logs, exports, or UI display.
 */
export function maskToken(token: string | undefined | null): string {
  if (!token) return "";
  if (token.length <= 8) return "********";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}
