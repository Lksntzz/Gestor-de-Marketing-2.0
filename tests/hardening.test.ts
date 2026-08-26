import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

async function read(path: string): Promise<string> {
  return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("v0.1.7.1 hardening invariants", () => {
  test("desktop packaging uses hardened backend and Electron bootstrap", async () => {
    const pkg = JSON.parse(await read("package.json"));
    expect(pkg.version).toBe("0.1.7-patch.1");
    expect(pkg.scripts.dev).toContain("server.ts");
    expect(pkg.scripts.build).toContain("server.ts");
    expect(pkg.scripts.build).toContain("electron-main.ts");
  });

  test("secure backend is loopback-only and protects every API route", async () => {
    const source = await read("secure-server.ts");
    expect(source).toContain('const LOOPBACK_HOST = "127.0.0.1"');
    expect(source).toContain('url.startsWith("/api/")');
    expect(source).toContain('x-app-session-token');
    expect(source).toContain('runtime: "nisti-secure-local"');
  });

  test("credential crypto has no deterministic key or reversible fallback", async () => {
    const source = await read("src/utils/crypto.ts");
    expect(source).toContain("enc_v3:");
    expect(source).not.toContain("nisti_vault_secure_client_device_key_v2");
    expect(source).not.toContain("nisti_pkm_salt_2026");
    expect(source).not.toContain("enc_obf:");
    expect(source).not.toContain("enc_v2:");
  });

  test("Google Drive is read-only and does not persist OAuth access tokens", async () => {
    const source = await read("src/services/googleDriveService.ts");
    expect(source).toContain("drive.readonly");
    expect(source).not.toContain("drive.file");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("localStorage");
  });

  test("user-facing application version is aligned", async () => {
    const source = await read("src/utils/reliability.ts");
    expect(source).toContain('APP_VERSION = "0.1.7.1"');
  });
});
