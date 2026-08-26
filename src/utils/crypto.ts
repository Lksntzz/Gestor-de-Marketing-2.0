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
      // Fallback below.
    }
  }

  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
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

const KEY_DB_NAME = "nisti_secure_crypto_v3";
const KEY_STORE_NAME = "keys";
const API_CONFIG_KEY_ID = "api-config-aes-gcm";

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }

    const request = indexedDB.open(KEY_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEY_STORE_NAME)) {
        db.createObjectStore(KEY_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open secure key store"));
  });
}

async function getStoredKey(db: IDBDatabase): Promise<CryptoKey | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE_NAME, "readonly");
    const request = tx.objectStore(KEY_STORE_NAME).get(API_CONFIG_KEY_ID);
    request.onsuccess = () => resolve((request.result as CryptoKey | undefined) || null);
    request.onerror = () => reject(request.error || new Error("Could not read encryption key"));
  });
}

async function storeKey(db: IDBDatabase, key: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE_NAME, "readwrite");
    tx.objectStore(KEY_STORE_NAME).put(key, API_CONFIG_KEY_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Could not persist encryption key"));
  });
}

/**
 * Uses a random, non-extractable AES-GCM key persisted by the browser as a
 * CryptoKey in IndexedDB. No encryption key or deterministic seed is embedded
 * in the application source.
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Web Crypto API unavailable");
  }

  const db = await openKeyDb();
  try {
    const existing = await getStoredKey(db);
    if (existing) return existing;

    const generated = (await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    )) as CryptoKey;
    await storeKey(db, generated);
    return generated;
  } finally {
    db.close();
  }
}

/**
 * Encrypts a sensitive string before storage. Fails closed when strong crypto
 * storage is unavailable; it never falls back to plaintext or reversible obfuscation.
 */
export async function encryptSecret(plainText: string): Promise<string> {
  if (!plainText) return "";

  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plainText);
  const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const payload = {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(cipherBuffer)),
  };
  return `enc_v3:${btoa(JSON.stringify(payload))}`;
}

/**
 * Decrypts the current encrypted format. Legacy fixed-key/obfuscated formats
 * are intentionally rejected so the user is asked to re-enter the credential.
 */
export async function decryptSecret(cipherText: string): Promise<string> {
  if (!cipherText) return "";
  if (!cipherText.startsWith("enc_")) return cipherText;
  if (!cipherText.startsWith("enc_v3:")) return "";

  try {
    const key = await getEncryptionKey();
    const payloadStr = atob(cipherText.slice("enc_v3:".length));
    const { iv, data } = JSON.parse(payloadStr);
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      key,
      new Uint8Array(data)
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    console.warn("Failed to decrypt secure credential:", err);
    return "";
  }
}
