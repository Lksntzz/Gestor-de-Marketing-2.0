import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

async function read(path: string): Promise<string> {
  return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("v2.0.0 hardening invariants", () => {
  test("desktop packaging uses hardened self-contained backend and Electron bootstrap", async () => {
    const pkg = JSON.parse(await read("package.json"));
    expect(pkg.version).toBe("2.0.0");
    expect(pkg.name).toBe("nisti-marketing");
    expect(pkg.scripts.dev).toContain("secure-server.ts");
    expect(pkg.scripts.build).toContain("scripts/build-backend.mjs");
    expect(pkg.scripts.build).toContain("electron-bootstrap.ts");
    expect(pkg.scripts.electronBuild || pkg.scripts["electron:build"]).toContain("verify");
    expect(pkg.build.productName).toBe("Nisti Marketing");
    expect(pkg.build.win.signAndEditExecutable).toBe(true);
    expect(pkg.build.nsis.useZip).toBe(true);
  });

  test("secure backend is loopback-only on desktop and requires the session token", async () => {
    const source = await read("secure-server.ts");
    expect(source).toContain('const LOOPBACK_HOST = "127.0.0.1"');
    expect(source).toContain('url.startsWith("/api/")');
    expect(source).toContain('providedToken !== SESSION_TOKEN');
    expect(source).toContain('runtime: "nisti-secure-local"');
    expect(source).not.toContain("sameOriginBrowser");
  });

  test("production backend build defers Vite and pdf parser imports", async () => {
    const buildScript = await read("scripts/build-backend.mjs");
    expect(buildScript).toContain('external: ["vite"]');
    expect(buildScript).toContain('await import("vite")');
    expect(buildScript).toContain('await import("pdf-parse")');
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

  test("Obsidian runtime fails closed until REST and physical Vault are validated", async () => {
    const desktop = await read("electron-main.ts");
    const apiSource = await read("src/services/api.ts");
    const runtime = await read("src/services/obsidianRuntimeState.ts");
    const main = await read("src/main.tsx");

    expect(desktop).toContain("obsidianConnectionAuthorized = false");
    expect(desktop).toContain("requireObsidianConnection");
    expect(desktop).toContain('ipcMain.handle("vault:connection-state"');
    expect(apiSource).toContain("setDesktopObsidianAuthorization(true)");
    expect(apiSource).toContain("setDesktopObsidianAuthorization(false)");
    expect(apiSource).toContain("markObsidianRuntimeConnected");
    expect(apiSource).toContain("markObsidianRuntimeDisconnected");
    expect(runtime).toContain("let connected = false");
    expect(main).toContain("ObsidianRuntimeGate");
    expect(main).toContain("OBSIDIAN_DISCONNECTED_EVENT");
  });

  test("Vault scan indexes supported document and image sources with epistemic status", async () => {
    const desktop = await read("electron-main.ts");
    const vault = await read("src/components/VaultView.tsx");

    expect(desktop).toContain('".pdf"');
    expect(desktop).toContain('".png"');
    expect(desktop).toContain('".jpg"');
    expect(desktop).toContain('".jpeg"');
    expect(desktop).toContain('".webp"');
    expect(desktop).toContain('".txt"');
    expect(desktop).toContain("epistemic_status");
    expect(desktop).toContain("CONFIRMADO");
    expect(desktop).toContain("HIPÓTESE");
    expect(desktop).toContain("PENDENTE");
    expect(vault).toContain("OBSIDIAN_SNAPSHOT_EVENT");
    expect(vault).toContain("vaultFolders");
  });

  test("knowledge ingestion is authenticated and only mutates UI after Obsidian confirms write", async () => {
    const apiSource = await read("src/services/api.ts");
    const knowledge = await read("src/components/AddKnowledgeView.tsx");
    const noteModal = await read("src/components/NoteModal.tsx");

    expect(apiSource).toContain("async processKnowledge");
    expect(apiSource).toContain('fetch("/api/gemini/process-knowledge"');
    expect(knowledge).toContain("api.processKnowledge");
    expect(knowledge).not.toContain('fetch("/api/gemini/process-knowledge"');
    expect(knowledge).toContain("api.pushNoteToObsidian");
    expect(knowledge.indexOf("api.pushNoteToObsidian")).toBeLessThan(knowledge.indexOf("onAddNote(newNote)"));
    expect(noteModal.indexOf("api.pushNoteToObsidian")).toBeLessThan(noteModal.indexOf("onSaveNote(newNote)"));
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
    expect(source).toContain("AES-GCM");
    expect(source).not.toContain("enc_fallback:");
    expect(source).not.toContain("return plainText");
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

  test("application identity is aligned to Nisti Marketing 2.0.0", async () => {
    const reliability = await read("src/utils/reliability.ts");
    const html = await read("index.html");
    const css = await read("src/index.css");
    expect(reliability).toContain('APP_VERSION = "2.0.0"');
    expect(html).toContain("<title>Nisti Marketing</title>");
    expect(html).not.toContain("fonts.googleapis.com");
    expect(css).not.toContain("Plus Jakarta Sans");
    expect(css).not.toContain("JetBrains Mono");
  });
});
