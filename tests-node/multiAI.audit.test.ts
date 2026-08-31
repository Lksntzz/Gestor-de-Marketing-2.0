import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { after, beforeEach, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { AIProviderError } from "../src/services/ai/AIProvider";
import { AIProviderFactory, executeWithModelFallback } from "../src/services/ai/AIProviderFactory";
import { GeminiProvider } from "../src/services/ai/providers/GeminiProvider";
import { OpenAIProvider } from "../src/services/ai/providers/OpenAIProvider";
import { StorageManager } from "../src/services/storage/StorageManager";
import type { ObsidianApiConfig } from "../src/types";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

const DEFAULT_CONFIG: ObsidianApiConfig = {
  endpoint: "https://127.0.0.1:27124",
  apiKey: "",
  geminiApiKey: "",
  openaiApiKey: "",
  aiProvider: "gemini",
  aiModel: "",
  vaultName: "MarketingVault",
  useHttps: true,
  autoSync: true,
  syncIntervalSeconds: 60,
  connectionStatus: "disconnected",
  allowSelfSignedCerts: true,
};

function responsePayload(text: string, status = 200): Response {
  const body = status >= 400
    ? { error: { message: text } }
    : { model: "gpt-test", output: [{ type: "message", content: [{ type: "output_text", text }] }] };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("OpenAI Responses API provider", () => {
  test("uses /v1/responses, strict schema and parses output[]", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const provider = new OpenAIProvider(
      { provider: "openai", apiKey: "openai-key", model: "gpt-test" },
      (async (url: string | URL | Request, init?: RequestInit) => {
        capturedUrl = String(url);
        capturedInit = init;
        return responsePayload('{"status":"ok","detail":"ready"}');
      }) as typeof fetch
    );

    const result = await provider.generateJson<{ status: string; detail: string }>({
      prompt: "Retorne o status",
      schemaName: "status_result",
      schema: {
        type: "object",
        properties: { status: { type: "string" }, detail: { type: "string" } },
        required: ["status"],
      },
    });

    assert.equal(capturedUrl, "https://api.openai.com/v1/responses");
    const body = JSON.parse(String(capturedInit?.body));
    assert.equal(body.store, false);
    assert.equal(body.text.format.type, "json_schema");
    assert.equal(body.text.format.strict, true);
    assert.equal(body.text.format.schema.additionalProperties, false);
    assert.deepEqual(body.text.format.schema.required, ["status", "detail"]);
    assert.deepEqual(result.data, { status: "ok", detail: "ready" });
  });

  test("maps PDF and image attachments to Responses input_file/input_image", async () => {
    let body: any;
    const provider = new OpenAIProvider(
      { provider: "openai", apiKey: "openai-key", model: "gpt-test" },
      (async (_url: string | URL | Request, init?: RequestInit) => {
        body = JSON.parse(String(init?.body));
        return responsePayload('{"summary":"ok"}');
      }) as typeof fetch
    );

    await provider.analyzeDocument({
      prompt: "Analise os anexos",
      schema: { type: "object", properties: { summary: { type: "string" } } },
      attachments: [
        { mimeType: "application/pdf", data: "cGRm", fileName: "fonte.pdf" },
        { mimeType: "image/png", data: "aW1n", fileName: "imagem.png" },
      ],
    });

    const content = body.input[0].content;
    assert.equal(content[1].type, "input_file");
    assert.equal(content[1].filename, "fonte.pdf");
    assert.match(content[1].file_data, /^data:application\/pdf;base64,/);
    assert.equal(content[2].type, "input_image");
    assert.match(content[2].image_url, /^data:image\/png;base64,/);
  });

  for (const [status, code] of [[401, "INVALID_API_KEY"], [429, "RATE_LIMIT"], [503, "SERVICE_UNAVAILABLE"]] as const) {
    test(`normalizes HTTP ${status} as ${code}`, async () => {
      const provider = new OpenAIProvider(
        { provider: "openai", apiKey: "wrong-key" },
        (async () => responsePayload(status === 401 ? "Incorrect API key" : "provider unavailable", status)) as typeof fetch
      );
      await assert.rejects(provider.testConnection(), (error: unknown) => {
        assert.ok(error instanceof AIProviderError);
        assert.equal(error.code, code);
        return true;
      });
    });
  }

  test("rejects invalid structured JSON", async () => {
    const provider = new OpenAIProvider(
      { provider: "openai", apiKey: "openai-key" },
      (async () => responsePayload("not-json")) as typeof fetch
    );
    await assert.rejects(provider.generateJson({ prompt: "JSON", schema: { type: "object", properties: {} } }), (error: unknown) => {
      assert.ok(error instanceof AIProviderError);
      assert.equal(error.code, "INVALID_RESPONSE");
      return true;
    });
  });
});

describe("Gemini provider compatibility", () => {
  test("keeps inline PDF/image payloads and temperature 0.1", async () => {
    let request: any;
    const provider = new GeminiProvider(
      { provider: "gemini", apiKey: "gemini-key", model: "gemini-test" },
      () => ({ models: { generateContent: async (input: any) => {
        request = input;
        return { text: '{"summary":"ok"}' };
      } } })
    );

    await provider.analyzeDocument({
      prompt: "Analise",
      temperature: 0.1,
      schema: { type: "object", properties: { summary: { type: "string" } }, additionalProperties: false },
      attachments: [
        { mimeType: "application/pdf", data: "cGRm" },
        { mimeType: "image/png", data: "aW1n" },
      ],
    });

    assert.equal(request.config.temperature, 0.1);
    assert.equal(request.contents[0].parts[1].inlineData.mimeType, "application/pdf");
    assert.equal(request.contents[0].parts[2].inlineData.mimeType, "image/png");
    assert.equal("additionalProperties" in request.config.responseSchema, false);
  });

  test("tries Gemini models in order until one succeeds", async () => {
    const attempts: string[] = [];
    const result = await executeWithModelFallback<{ status: string }>(
      { provider: "gemini", apiKey: "gemini-key" },
      ["gemini-one", "gemini-two"],
      { prompt: "Analise", temperature: 0.1 },
      "analyzeDocument",
      (config) => ({
        name: "gemini",
        generateText: async () => { throw new Error("unused"); },
        generateJson: async () => { throw new Error("unused"); },
        analyzeDocument: async <T>() => {
          attempts.push(config.model || "");
          if (config.model === "gemini-one") throw new Error("first unavailable");
          return {
            provider: "gemini",
            model: config.model || "",
            text: '{"status":"ok"}',
            data: { status: "ok" } as T,
          };
        },
        testConnection: async () => ({ success: true, provider: "gemini", model: config.model || "" }),
      })
    );

    assert.deepEqual(attempts, ["gemini-one", "gemini-two"]);
    assert.equal(result.model, "gemini-two");
  });
});

describe("AIProviderFactory validation", () => {
  test("normalizes undefined and null configurations", () => {
    for (const config of [undefined, null]) {
      assert.throws(() => AIProviderFactory.create(config), (error: unknown) => {
        assert.ok(error instanceof AIProviderError);
        assert.equal(error.code, "MISSING_CONFIG");
        return true;
      });
    }
  });
});

describe("secure AI configuration", () => {
  beforeEach(() => {
    (globalThis as any).localStorage = new MemoryStorage();
    delete (globalThis as any).window;
  });

  test("persists only non-secret configuration and sends real values to safeStorage", async () => {
    const calls: Array<[string, string]> = [];
    (globalThis as any).window = {
      electronAPI: {
        setSecret: async (name: string, value: string) => { calls.push([name, value]); return { success: true }; },
        setAIConfig: async () => ({ success: true }),
      },
    };
    const storage = StorageManager.getInstance();
    await storage.saveApiConfig({
      ...DEFAULT_CONFIG,
      apiKey: "obsidian-secret",
      geminiApiKey: "gemini-secret",
      openaiApiKey: "openai-secret",
      aiProvider: "openai",
      aiModel: "gpt-test",
    });

    assert.deepEqual(calls, [
      ["obsidianApiKey", "obsidian-secret"],
      ["geminiApiKey", "gemini-secret"],
      ["openaiApiKey", "openai-secret"],
    ]);
    const persisted = localStorage.getItem("nisti_pkm_api_config_secure_v2") || "";
    assert.equal(persisted.includes("obsidian-secret"), false);
    assert.equal(persisted.includes("gemini-secret"), false);
    assert.equal(persisted.includes("openai-secret"), false);
  });

  test("recovers all safeStorage keys when no persisted configuration exists", async () => {
    const secrets: Record<string, string> = {
      obsidianApiKey: "obsidian-secret",
      geminiApiKey: "gemini-secret",
      openaiApiKey: "openai-secret",
    };
    (globalThis as any).window = { electronAPI: { getSecret: async (name: string) => secrets[name] || "" } };
    const loaded = await StorageManager.getInstance().loadApiConfig(DEFAULT_CONFIG);
    assert.equal(loaded.apiKey, "obsidian-secret");
    assert.equal(loaded.geminiApiKey, "gemini-secret");
    assert.equal(loaded.openaiApiKey, "openai-secret");
  });

  test("migrates legacy secrets to safeStorage and removes legacy localStorage", async () => {
    const saved: Record<string, string> = {};
    (globalThis as any).window = {
      electronAPI: {
        setSecret: async (name: string, value: string) => { saved[name] = value; return { success: true }; },
        setAIConfig: async () => ({ success: true }),
      },
    };
    localStorage.setItem("obsidian_api_config", JSON.stringify({
      ...DEFAULT_CONFIG,
      apiKey: "legacy-obsidian",
      geminiApiKey: "legacy-gemini",
      openaiApiKey: "legacy-openai",
    }));

    await StorageManager.getInstance().loadApiConfig(DEFAULT_CONFIG);
    assert.equal(localStorage.getItem("obsidian_api_config"), null);
    assert.equal(saved.geminiApiKey, "legacy-gemini");
    assert.equal(saved.openaiApiKey, "legacy-openai");
    const persisted = localStorage.getItem("nisti_pkm_api_config_secure_v2") || "";
    assert.equal(persisted.includes("legacy-"), false);
  });

  test("loads only the active provider secret for an AI request", async () => {
    const requested: string[] = [];
    localStorage.setItem("nisti_pkm_api_config_secure_v2", JSON.stringify({ aiProvider: "openai", aiModel: "gpt-test" }));
    (globalThis as any).window = {
      electronAPI: { getSecret: async (name: string) => { requested.push(name); return "selected-key"; } },
    };
    const config = await StorageManager.getInstance().loadAIRequestConfig(DEFAULT_CONFIG);
    assert.equal(config.provider, "openai");
    assert.equal(config.apiKey, "selected-key");
    assert.deepEqual(requested, ["openaiApiKey"]);
  });
});

describe("IPC and provider boundaries", () => {
  test("every preload invoke has one main-process handler and secret handlers are unique", async () => {
    const [preload, main, bootstrap, vaultIpc] = await Promise.all([
      readFile(path.join(ROOT, "src/preload.ts"), "utf8"),
      readFile(path.join(ROOT, "electron-main.ts"), "utf8"),
      readFile(path.join(ROOT, "electron-bootstrap.ts"), "utf8"),
      readFile(path.join(ROOT, "src/electron/knowledge/registerVaultIpc.ts"), "utf8"),
    ]);
    const invoked = [...preload.matchAll(/ipcRenderer\.invoke\("([^"]+)"/g)].map((match) => match[1]);
    const handled = [...`${main}\n${bootstrap}\n${vaultIpc}`.matchAll(/ipcMain\.handle\("([^"]+)"/g)].map((match) => match[1]);
    for (const channel of invoked) {
      assert.equal(handled.filter((candidate) => candidate === channel).length, 1, channel);
    }
    for (const channel of ["secret:set", "secret:get", "secret:delete"]) {
      assert.equal(handled.filter((candidate) => candidate === channel).length, 1, channel);
    }
    assert.equal(preload.includes("ai:process-knowledge"), false);
    assert.equal(preload.includes("ai:generate-campaign"), false);
    assert.match(main, /GEMINI_ASSET_MODELS\s*=\s*\["gemini-flash-latest", "gemini-3\.1-flash-lite", "gemini-3\.7-flash"\]/);
    assert.match(main, /executeWithModelFallback/);
    assert.match(main, /temperature:\s*aiConfig\.provider === "gemini" \? 0\.1 : undefined/);
  });
});

let serverProcess: ChildProcess | undefined;
let serverDiagnostics = "";
let serverSpawnError = "";

function appendServerDiagnostic(chunk: Buffer | string): void {
  if (serverDiagnostics.length >= 4000) return;
  serverDiagnostics += String(chunk).slice(0, 4000 - serverDiagnostics.length);
}

after(() => {
  serverProcess?.kill();
});

async function freePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForHealth(baseUrl: string, child: ChildProcess): Promise<void> {
  const timeoutMs = process.platform === "win32" ? 45_000 : 15_000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (serverSpawnError) {
      throw new Error(`Local integration server failed to spawn: ${serverSpawnError}`);
    }
    if (child.exitCode !== null) {
      const detail = serverDiagnostics.trim() || `exit code ${child.exitCode}`;
      throw new Error(`Local integration server exited before health-check: ${detail}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Retry while the local test server starts.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  const detail = serverDiagnostics.trim();
  throw new Error(`Local integration server did not start within ${timeoutMs}ms.${detail ? ` Diagnostics: ${detail}` : ""}`);
}

test("legacy aliases preserve local/offline behavior and legacy error status", async () => {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  serverDiagnostics = "";
  serverSpawnError = "";
  serverProcess = spawn(process.execPath, ["--import", "tsx", path.join(ROOT, "secure-server.ts")], {
    cwd: ROOT,
    env: {
      ...process.env,
      GEMINI_API_KEY: "",
      OPENAI_API_KEY: "",
      NODE_ENV: "production",
      NISTI_APP_PORT: String(port),
      NISTI_INSTANCE_ID: "multi-ai-audit-test",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  serverProcess.stdout?.on("data", appendServerDiagnostic);
  serverProcess.stderr?.on("data", appendServerDiagnostic);
  serverProcess.once("error", (error) => {
    serverSpawnError = error.message;
  });

  await waitForHealth(baseUrl, serverProcess);
  const session = await fetch(`${baseUrl}/api/auth/session`).then((response) => response.json()) as { token: string };
  const headers = { "Content-Type": "application/json", "x-app-session-token": session.token };
  const localBody = JSON.stringify({ campaignName: "Teste", objective: "Validar", engineMode: "local" });

  const modern = await fetch(`${baseUrl}/api/ai/generate-guidelines`, { method: "POST", headers, body: localBody });
  const legacy = await fetch(`${baseUrl}/api/gemini/generate-guidelines`, { method: "POST", headers, body: localBody });
  assert.equal(modern.status, 200);
  assert.equal(legacy.status, 200);
  const modernPayload = await modern.json() as Record<string, any>;
  const legacyPayload = await legacy.json() as Record<string, any>;
  assert.deepEqual(legacyPayload, {
    success: true,
    data: modernPayload.data,
    usedModel: "local-grounded-engine",
    wasFallback: false,
  });
  assert.deepEqual(modernPayload.sources, []);
  const warning = String(modernPayload.contextWarning);
  assert.match(warning, /Nenhum documento canônico relevante foi encontrado no Vault/i);
  assert.match(warning, /sem garantias/i);

  const aiBody = JSON.stringify({ campaignName: "Teste", objective: "Validar", engineMode: "ai" });
  const modernMissingKey = await fetch(`${baseUrl}/api/ai/generate-guidelines`, { method: "POST", headers, body: aiBody });
  const legacyMissingKey = await fetch(`${baseUrl}/api/gemini/generate-guidelines`, { method: "POST", headers, body: aiBody });
  assert.equal(modernMissingKey.status, 400);
  assert.equal(legacyMissingKey.status, 500);
  const legacyError = await legacyMissingKey.json() as Record<string, unknown>;
  assert.deepEqual(Object.keys(legacyError).sort(), ["error", "success"]);
});