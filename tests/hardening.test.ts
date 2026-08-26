import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

async function read(path: string): Promise<string> {
  return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("v1.0.1 hardening invariants", () => {
  test("desktop packaging uses a self-contained hardened backend and Electron bootstrap", async () => {
    const pkg = JSON.parse(await read("package.json"));
    const backendBuilder = await read("scripts/build-backend.mjs");
    expect(pkg.version).toBe("1.0.1");
    expect(pkg.scripts.dev).toContain("secure-server.ts");
    expect(pkg.scripts.build).toContain("scripts/build-backend.mjs");
    expect(pkg.scripts.build).toContain("electron-bootstrap.ts");
    expect(backendBuilder).toContain('entryPoints: ["secure-server.ts"]');
    expect(backendBuilder).toContain('external: ["vite"]');
    expect(backendBuilder).toContain('await import("vite")');
    expect(pkg.scripts.electronBuild || pkg.scripts["electron:build"]).toContain("verify");
    expect(pkg.build.files).toContain("dist/**/*");
  });

  test("secure backend is loopback-only on desktop and requires the session token", async () => {
    const source = await read("secure-server.ts");
    expect(source).toContain('const LOOPBACK_HOST = "127.0.0.1"');
    expect(source).toContain('url.startsWith("/api/")');
    expect(source).toContain('providedToken !== SESSION_TOKEN');
    expect(source).toContain('runtime: "nisti-secure-local"');
    expect(source).not.toContain("sameOriginBrowser");
  });

  test("authenticated session also covers PDF, YouTube and other direct ingestion requests", async () => {
    const secureServer = await read("secure-server.ts");
    const apiSource = await read("src/services/api.ts");
    expect(secureServer).toContain("HttpOnly; SameSite=Strict; Path=/api/");
    expect(secureServer).toContain("cachedGeminiApiKey");
    expect(secureServer).toContain('getCookieValue(req.headers.cookie, "nisti_session")');
    expect(apiSource).toContain("const [headers, config] = await Promise.all");
    expect(apiSource).toContain('fetch("/api/health", { cache: "no-store", headers })');
    expect(apiSource).toContain("async processKnowledge(");
  });

  test("Obsidian Local REST HTTPS accepts only loopback self-signed certificates", async () => {
    const source = await read("secure-server.ts");
    expect(source).toContain("rejectUnauthorized: false");
    expect(source).toContain("isLoopbackHostname(parsed.hostname)");
    expect(source).toContain('parsed.port === "27124"');
    expect(source).toContain('parsed.protocol = "https:"');
  });

  test("Obsidian setup validates REST, binds the physical Vault and publishes the full snapshot", async () => {
    const source = await read("src/services/api.ts");
    expect(source).toContain("requestObsidianConnectionTest");
    expect(source).toContain("setDesktopObsidianAuthorization(true)");
    expect(source).toContain("window.electronAPI.selectVault()");
    expect(source).toContain("window.electronAPI.listVaultFolders()");
    expect(source).toContain("publishCurrentDesktopVaultSnapshot");
    expect(source).toContain("Base sincronizada automaticamente");
  });

  test("knowledge filesystem is fail-closed until Obsidian REST connection is verified", async () => {
    const main = await read("electron-main.ts");
    const preload = await read("src/preload.ts");
    const hook = await read("src/hooks/usePersistentState.ts");
    const runtime = await read("src/services/obsidianRuntimeState.ts");

    expect(main).toContain("let obsidianConnectionAuthorized = false");
    expect(main).toContain("requireObsidianConnection()");
    expect(main).toContain('ipcMain.handle("vault:connection-state"');
    expect(main).toContain('ipcMain.handle("vault:list-folders"');
    expect(preload).toContain("setObsidianConnectionState");
    expect(preload).toContain("listVaultFolders");
    expect(hook).toContain("Knowledge state mutation blocked").not;
    expect(hook).toContain("Banco de conhecimento indisponível");
    expect(hook).toContain("OBSIDIAN_DISCONNECTED_EVENT");
    expect(runtime).toContain("OBSIDIAN_SNAPSHOT_EVENT");
  });

  test("manual note creation writes to verified Obsidian before reporting success", async () => {
    const source = await read("src/components/NoteModal.tsx");
    expect(source).toContain("api.isObsidianSessionVerified()");
    expect(source).toContain("api.pushNoteToObsidian");
    expect(source).toContain("await window.electronAPI.listVaultFolders()");
    expect(source).toContain("A nota não foi salva");
  });

  test("desktop secret store protects both Obsidian and Gemini credentials", async () => {
    const bootstrap = await read("electron-bootstrap.ts");
    expect(bootstrap).toContain('"obsidianApiKey"');
    expect(bootstrap).toContain('"geminiApiKey"');
    expect(bootstrap).toContain('cwd: path.resolve(__dirname, "..")');

    const storage = await read("src/services/storage/StorageManager.ts");
    expect(storage).toContain('setSecret("obsidianApiKey"');
    expect(storage).toContain('setSecret("geminiApiKey"');
    expect(storage).toContain('getSecret("obsidianApiKey"');
    expect(storage).toContain('getSecret("geminiApiKey"');
  });

  test("Gemini client reads credentials through secure config rather than legacy plaintext storage", async () => {
    const source = await read("src/services/api.ts");
    expect(source).toContain("storage.loadApiConfig");
    expect(source).toContain("testGeminiConnection");
    expect(source).toContain('headers["x-gemini-api-key"]');
    expect(source).not.toContain('localStorage.getItem("obsidian_api_config")');
  });

  test("local engine keeps unsupported business claims pending", async () => {
    const source = await read("src/utils/localEngine.ts");
    expect(source).toContain("CONFIRMADO, HIPÓTESE ou PENDENTE");
    expect(source).toContain("não deve inventar preços, prazos, métricas");
    expect(source).not.toContain("Margem de até 150%");
    expect(source).not.toContain("Produção ágil em até 5 dias úteis");
    expect(source).not.toContain("a partir de 10 unidades");
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

  test("application identity is Nisti Marketing while preserving the existing user data profile", async () => {
    const html = await read("index.html");
    const pkg = JSON.parse(await read("package.json"));
    const main = await read("electron-main.ts");
    const bootstrap = await read("electron-bootstrap.ts");

    expect(html).toContain("<title>Nisti Marketing</title>");
    expect(html).not.toContain("My Google AI Studio App");
    expect(pkg.build.productName).toBe("Nisti Marketing");
    expect(pkg.build.nsis.shortcutName).toBe("Nisti Marketing");
    expect(main).toContain('title: "Nisti Marketing"');
    expect(main).toContain("Menu.setApplicationMenu(null)");
    expect(bootstrap).toContain('app.setName("Nisti Marketing")');
    expect(bootstrap).toContain('STABLE_USER_DATA_NAME = "Nisti Print PKM Marketing Hub"');
  });
});
