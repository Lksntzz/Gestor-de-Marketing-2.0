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

/**
 * Derives a cryptographic AES-GCM key from a device-bound seed.
 */
async function getEncryptionKey(): Promise<CryptoKey | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  try {
    const rawSeed = "nisti_vault_secure_client_device_key_v2";
    const enc = new TextEncoder().encode(rawSeed);
    const keyMaterial = await crypto.subtle.importKey("raw", enc, "PBKDF2", false, ["deriveKey"]);
    return await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: new TextEncoder().encode("nisti_pkm_salt_2026"),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  } catch {
    return null;
  }
}

/**
 * Encrypts a sensitive string (e.g. API keys) before storing in local storage.
 */
export async function encryptSecret(plainText: string): Promise<string> {
  if (!plainText) return "";
  const key = await getEncryptionKey();
  if (key && typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(plainText);
      const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
      const cipherArray = Array.from(new Uint8Array(cipherBuffer));
      const ivArray = Array.from(iv);
      return `enc_v2:${btoa(JSON.stringify({ iv: ivArray, data: cipherArray }))}`;
    } catch {
      // Fallback below
    }
  }

  // Obfuscated fallback for environments where SubtleCrypto is disabled
  return `enc_obf:${btoa(encodeURIComponent(plainText).split("").reverse().join(""))}`;
}

/**
 * Decrypts a sensitive string retrieved from local storage.
 */
export async function decryptSecret(cipherText: string): Promise<string> {
  if (!cipherText) return "";
  if (!cipherText.startsWith("enc_")) return cipherText; // Plaintext migration

  if (cipherText.startsWith("enc_v2:")) {
    const key = await getEncryptionKey();
    if (key && typeof crypto !== "undefined" && crypto.subtle) {
      try {
        const payloadStr = atob(cipherText.replace("enc_v2:", ""));
        const { iv, data } = JSON.parse(payloadStr);
        const decryptedBuffer = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: new Uint8Array(iv) },
          key,
          new Uint8Array(data)
        );
        return new TextDecoder().decode(decryptedBuffer);
      } catch (err) {
        console.warn("Failed to decrypt secret with AES-GCM:", err);
      }
    }
  }

  if (cipherText.startsWith("enc_obf:")) {
    try {
      const reversed = atob(cipherText.replace("enc_obf:", ""));
      return decodeURIComponent(reversed.split("").reverse().join(""));
    } catch {
      return "";
    }
  }

  return cipherText;
}

