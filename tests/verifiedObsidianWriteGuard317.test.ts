import { afterEach, describe, expect, test } from "bun:test";
import type { ObsidianApiConfig } from "../src/types";
import { writeVerifiedObsidianNote } from "../src/services/verifiedObsidianWriteGuard";

const config: ObsidianApiConfig = {
  endpoint: "https://127.0.0.1:27124",
  apiKey: "saved-in-secure-storage",
  geminiApiKey: "",
  openaiApiKey: "",
  aiProvider: "gemini",
  aiModel: "",
  vaultName: "Vault ativo",
  useHttps: true,
  autoSync: true,
  syncIntervalSeconds: 60,
  connectionStatus: "connected",
  allowSelfSignedCerts: true,
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("verified Obsidian write guard 3.1.7", () => {
  test("só confirma sucesso depois de GET -> PUT -> GET com conteúdo idêntico", async () => {
    const proxyMethods: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/auth/session") return jsonResponse({ success: true, token: "session-test" });

      const body = JSON.parse(String(init?.body || "{}"));
      proxyMethods.push(body.method);
      if (body.method === "GET" && proxyMethods.length === 1) {
        return jsonResponse({ success: false, status: 404, message: "not found" }, 404);
      }
      if (body.method === "PUT") {
        expect(body.path).toBe("/vault/00_Inbox/Teste%20escrita%20Nisti.md");
        return jsonResponse({ success: true, status: 204, data: "" });
      }
      return jsonResponse({
        success: true,
        status: 200,
        data: "---\nepistemic_status: CONFIRMADO\n---\n\n# Teste\n\nTESTE-NISTI-ESCRITA-003",
      });
    }) as typeof fetch;

    const result = await writeVerifiedObsidianNote(
      config,
      "00_Inbox/Teste escrita Nisti.md",
      "# Teste\n\nTESTE-NISTI-ESCRITA-003",
      { epistemic_status: "CONFIRMADO" },
    );

    expect(result.success).toBe(true);
    expect(result.path).toBe("00_Inbox/Teste escrita Nisti.md");
    expect(proxyMethods).toEqual(["GET", "PUT", "GET"]);
  });

  test("bloqueia explicitamente colisão antes do PUT", async () => {
    const proxyMethods: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/auth/session") return jsonResponse({ success: true, token: "session-test" });
      const body = JSON.parse(String(init?.body || "{}"));
      proxyMethods.push(body.method);
      return jsonResponse({ success: true, status: 200, data: "# Já existe" });
    }) as typeof fetch;

    const result = await writeVerifiedObsidianNote(
      config,
      "00_Inbox/Teste escrita Nisti.md",
      "# Novo conteúdo",
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("bloqueada");
    expect(proxyMethods).toEqual(["GET"]);
  });

  test("recusa falso positivo quando a releitura não corresponde", async () => {
    const proxyMethods: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/auth/session") return jsonResponse({ success: true, token: "session-test" });
      const body = JSON.parse(String(init?.body || "{}"));
      proxyMethods.push(body.method);
      if (body.method === "GET" && proxyMethods.length === 1) {
        return jsonResponse({ success: false, status: 404 }, 404);
      }
      if (body.method === "PUT") return jsonResponse({ success: true, status: 204 });
      return jsonResponse({ success: true, status: 200, data: "# Conteúdo errado" });
    }) as typeof fetch;

    const result = await writeVerifiedObsidianNote(
      config,
      "00_Inbox/Teste escrita Nisti.md",
      "# Conteúdo esperado",
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("não corresponde");
    expect(proxyMethods).toEqual(["GET", "PUT", "GET"]);
  });
});
