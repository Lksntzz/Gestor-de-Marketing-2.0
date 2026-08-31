import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const panel = readFileSync(join(root, "src/components/AIConnectionSettingsPanel.tsx"), "utf8");
const modal = readFileSync(join(root, "src/components/ObsidianApiSettingsModal.tsx"), "utf8");

describe("AI connection Stage 5B settings panel", () => {
  test("canonical panel only uses the trusted single-connection bridge", () => {
    expect(panel).toContain("setAIConnectionCredential");
    expect(panel).toContain("clearAIConnectionCredential");
    expect(panel).toContain("getAIConnectionState");
    expect(panel).toContain("confirmAIProvider");
    expect(panel).toContain("validateAIModel");

    expect(panel).not.toContain("geminiApiKey");
    expect(panel).not.toContain("openaiApiKey");
    expect(panel).not.toContain("getSecret(");
    expect(panel).not.toContain("api.testAIConnection");
  });

  test("model selection comes from discovered proposal models instead of free text", () => {
    expect(panel).toContain("const models = proposal?.models ?? []");
    expect(panel).toContain("models.map((model)");
    expect(panel).toContain("<select");
    expect(panel).not.toContain('placeholder="gpt-');
    expect(panel).not.toContain('placeholder="gemini-');
  });

  test("settings modal delegates the primary AI tab to the canonical panel", () => {
    expect(modal).toContain('import { AIConnectionSettingsPanel } from "./AIConnectionSettingsPanel"');
    expect(modal).toContain('<AIConnectionSettingsPanel />');
    expect(modal).not.toContain("Chave de API do Google Gemini");
    expect(modal).not.toContain("Chave de API da OpenAI");
    expect(modal).not.toContain("handleTestAI");
  });
});
