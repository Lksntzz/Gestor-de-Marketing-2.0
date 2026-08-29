import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

async function read(path: string): Promise<string> {
  return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("v2 hardening invariants", () => {
  test("desktop packaging uses hardened self-contained backend and Electron bootstrap", async () => {
    const pkg = JSON.parse(await read("package.json"));
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.name).toBe("nisti-marketing");
    expect(pkg.scripts.dev).toContain("secure-server.ts");
    expect(pkg.scripts.build).toContain("scripts/build-backend.mjs");
    expect(pkg.scripts.build).toContain("electron-bootstrap.ts");
    expect(pkg.scripts.electronBuild || pkg.scripts["electron:build"]).toContain("verify");
    expect(pkg.build.productName).toBe("Nisti Marketing");
    expect(pkg.build.win.signAndEditExecutable).toBe(true);
    expect(pkg.build.nsis.useZip ?? false).toBe(false);
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

  test("desktop secret store protects Obsidian, Gemini and OpenAI credentials", async () => {
    const bootstrap = await read("electron-bootstrap.ts");
    expect(bootstrap).toContain('"obsidianApiKey"');
    expect(bootstrap).toContain('"geminiApiKey"');
    expect(bootstrap).toContain('"openaiApiKey"');
    expect(bootstrap).toContain('cwd: path.resolve(__dirname, "..")');

    const storage = await read("src/services/storage/StorageManager.ts");
    expect(storage).toContain('setSecret("obsidianApiKey"');
    expect(storage).toContain('setSecret("geminiApiKey"');
    expect(storage).toContain('setSecret("openaiApiKey"');
    expect(storage).toContain('getSecret("obsidianApiKey"');
    expect(storage).toContain('getSecret("geminiApiKey"');
    expect(storage).toContain('getSecret("openaiApiKey"');
    expect(storage).not.toContain("encryptSecret(");
    expect(storage).not.toContain("fallback_plain:");
  });

  test("AI client reads provider credentials through secure config rather than legacy plaintext storage", async () => {
    const source = await read("src/services/api.ts");
    expect(source).toContain("storage.loadAIRequestConfig");
    expect(source).toContain("testAIConnection");
    expect(source).toContain('headers["x-ai-api-key"]');
    expect(source).toContain('headers["x-ai-provider"]');
    expect(source).not.toContain('headers["x-gemini-api-key"]');
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

  test("settings cannot simulate a connected Obsidian session", async () => {
    const settings = await read("src/components/ObsidianApiSettingsModal.tsx");
    const storage = await read("src/services/storage/StorageManager.ts");

    expect(settings).toContain("api.isObsidianSessionVerified()");
    expect(settings).toContain("O status conectado só é liberado depois");
    expect(settings).not.toContain("Ativar Conexão Sandbox");
    expect(settings).not.toContain("Conexão Sandbox ativada com sucesso");
    expect(storage).toContain('connectionStatus: "disconnected"');
  });

  test("desktop note persistence fails closed instead of falling back to localStorage", async () => {
    const storage = await read("src/services/storage/StorageManager.ts");

    expect(storage).toContain("isObsidianRuntimeConnected");
    expect(storage).toContain("A gravação foi bloqueada");
    expect(storage).toContain("A exclusão foi bloqueada");
    expect(storage).toContain("Desktop Vault read failed closed");
    expect(storage).not.toContain("Desktop filesystem read failed, falling back to local sandbox");
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
    expect(apiSource).toContain('fetch("/api/ai/process-knowledge"');
    expect(knowledge).toContain("api.processKnowledge");
    expect(knowledge).not.toContain('fetch("/api/gemini/process-knowledge"');
    expect(knowledge).toContain("api.pushNoteToObsidian");
    expect(knowledge.indexOf("api.pushNoteToObsidian")).toBeLessThan(knowledge.indexOf("onAddNote(newNote)"));
    expect(noteModal.indexOf("api.pushNoteToObsidian")).toBeLessThan(noteModal.indexOf("onSaveNote(newNote)"));
  });

  test("initial product state contains no fabricated tasks, personas, metrics or routine", async () => {
    const defaultVault = await read("src/data/defaultVault.ts");
    const routine = await read("src/data/routineData.ts");

    expect(defaultVault).toContain("DEFAULT_TASKS: MarketingTask[] = []");
    expect(defaultVault).not.toContain("Black Friday");
    expect(defaultVault).not.toContain("Always-On");
    expect(routine).toContain("DEFAULT_NICHES: NicheSegment[] = []");
    expect(routine).toContain("DEFAULT_POST_HISTORY: PostHistoryItem[] = []");
    expect(routine).toContain("DEFAULT_LEARNING_INSIGHTS: LearningInsight[] = []");
    expect(routine).toContain("DEFAULT_WEEKLY_ROUTINE: DailyRoutineSlot[] = []");
    expect(routine).not.toContain("saas_founders");
    expect(routine).not.toContain("conversionAvgRate");
  });

  test("server fallbacks are source-grounded and YouTube remains metadata-only", async () => {
    const source = await read("server.ts");

    expect(source).toContain("metadata-only");
    expect(source).toContain("payload?.videoTitle");
    expect(source).toContain("payload?.videoChannel");
    expect(source).toContain("conteúdo audiovisual/transcrição não foi analisado");
    expect(source).toContain("local-structural-audit");
    expect(source).not.toContain("a partir de 10 unidades");
    expect(source).not.toContain("Ganchos nos primeiros 3 segundos retêm até 70%");
    expect(source).not.toContain("readinessScore: 92");
  });

  test("local engine never promotes unscheduled suggestions into execution tasks", async () => {
    const source = await read("src/utils/localEngine.ts");

    expect(source).toContain("CONFIRMADO, HIPÓTESE ou PENDENTE");
    expect(source).toContain("não inventa preços, prazos, datas de publicação, métricas");
    expect(source).toContain('status: "EM REVISÃO"');
    expect(source).toContain("tasks: []");
    expect(source).toContain("taskSuggestions");
    expect(source).toContain("Checklist sugerido — requer registro humano antes de virar tarefa");
    expect(source).toContain("reviewCandidates");
    expect(source).toContain("Nenhum foi criado automaticamente");
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

  test("application identity stays aligned with package version", async () => {
    const pkg = JSON.parse(await read("package.json"));
    const reliability = await read("src/utils/reliability.ts");
    const html = await read("index.html");
    const css = await read("src/index.css");
    expect(reliability).toContain(`APP_VERSION = "${pkg.version}"`);
    expect(html).toContain("<title>Nisti Marketing</title>");
    expect(html).not.toContain("fonts.googleapis.com");
    expect(css).not.toContain("Plus Jakarta Sans");
    expect(css).not.toContain("JetBrains Mono");
  });
});
