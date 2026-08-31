import { describe, test, expect } from "bun:test";
import { evaluateEpistemicWeight } from "../src/services/knowledge/EpistemicClassifier";
import {
  parseLoopbackEndpoint,
  validateObsidianProxyPath,
  validateObsidianProxyMethod,
  sanitizeObsidianForwardHeaders,
} from "../src/services/obsidian/obsidianEndpointValidator";

describe("P0 Security & Epistemic Integrity Invariants", () => {
  describe("P0 — SSRF Protection for Obsidian Loopback Integration (Real Implementation)", () => {
    test("allows legitimate local Obsidian loopback endpoints on authorized ports", () => {
      expect(parseLoopbackEndpoint("http://127.0.0.1:27124").hostname).toBe("127.0.0.1");
      expect(parseLoopbackEndpoint("https://127.0.0.1:27124").hostname).toBe("127.0.0.1");
      expect(parseLoopbackEndpoint("http://localhost:27124").hostname).toBe("localhost");
      expect(parseLoopbackEndpoint("https://localhost:27123").hostname).toBe("localhost");
    });

    test("blocks non-loopback hosts, 0.0.0.0, arbitrary domains and cloud metadata", () => {
      // Cloud metadata endpoints
      expect(() => parseLoopbackEndpoint("http://169.254.169.254/latest/meta-data/")).toThrow(/SSRF Bloqueado/);
      expect(() => parseLoopbackEndpoint("http://metadata.google.internal/computeMetadata/v1/")).toThrow(/SSRF Bloqueado/);

      // Insecure aliases and non-strict addresses
      expect(() => parseLoopbackEndpoint("http://0.0.0.0:27124")).toThrow(/SSRF Bloqueado/);
      expect(() => parseLoopbackEndpoint("https://local.obsidian.md:27124")).toThrow(/SSRF Bloqueado/);
      expect(() => parseLoopbackEndpoint("http://vault.localhost:27124")).toThrow(/SSRF Bloqueado/);

      // Public internet hosts
      expect(() => parseLoopbackEndpoint("http://google.com:27124")).toThrow(/SSRF Bloqueado/);
      expect(() => parseLoopbackEndpoint("https://api.openai.com")).toThrow(/SSRF Bloqueado/);
      expect(() => parseLoopbackEndpoint("http://evil-attacker.com:27124")).toThrow(/SSRF Bloqueado/);

      // Private LAN hosts (non-loopback)
      expect(() => parseLoopbackEndpoint("http://192.168.1.100:27124")).toThrow(/SSRF Bloqueado/);
      expect(() => parseLoopbackEndpoint("http://10.0.0.5:27124")).toThrow(/SSRF Bloqueado/);
      expect(() => parseLoopbackEndpoint("http://172.16.0.10:27124")).toThrow(/SSRF Bloqueado/);

      // Invalid schemes
      expect(() => parseLoopbackEndpoint("file:///etc/passwd")).toThrow(/Protocolo/);
      expect(() => parseLoopbackEndpoint("gopher://127.0.0.1:70")).toThrow(/Protocolo/);
      expect(() => parseLoopbackEndpoint("ftp://127.0.0.1")).toThrow(/Protocolo/);
    });

    test("blocks sensitive local services and privileged ports", () => {
      expect(() => parseLoopbackEndpoint("http://127.0.0.1:3000")).toThrow(/SSRF Bloqueado/);
      expect(() => parseLoopbackEndpoint("http://127.0.0.1:3306")).toThrow(/SSRF Bloqueado/);
      expect(() => parseLoopbackEndpoint("http://127.0.0.1:5432")).toThrow(/SSRF Bloqueado/);
      expect(() => parseLoopbackEndpoint("http://127.0.0.1:6379")).toThrow(/SSRF Bloqueado/);
      expect(() => parseLoopbackEndpoint("http://127.0.0.1:22")).toThrow(/SSRF Bloqueado/);
      expect(() => parseLoopbackEndpoint("http://127.0.0.1:80")).toThrow(/SSRF Bloqueado/);
    });

    test("sanitizes proxy paths and prevents path traversal", () => {
      expect(validateObsidianProxyPath("/vault/01_Estrategia/Brand.md")).toBe("/vault/01_Estrategia/Brand.md");
      expect(validateObsidianProxyPath("/")).toBe("/");
      expect(validateObsidianProxyPath("/active/")).toBe("/active/");
      
      expect(() => validateObsidianProxyPath("/vault/../../etc/passwd")).toThrow(/Path traversal/);
      expect(() => validateObsidianProxyPath("/unauthorized_internal_route")).toThrow(/não é uma rota autorizada/);
    });

    test("sanitizes headers preventing Authorization overwrite", () => {
      const sanitized = sanitizeObsidianForwardHeaders(
        {
          Authorization: "Bearer malicious_token",
          Host: "evil.com",
          "Content-Type": "application/json",
          "X-Custom": "custom-val"
        },
        "real_secure_token"
      );

      expect(sanitized["Authorization"]).toBe("Bearer real_secure_token");
      expect(sanitized["Content-Type"]).toBe("application/json");
      expect(sanitized["Host"]).toBeUndefined();
      expect(sanitized["X-Custom"]).toBeUndefined();
    });

    test("validates HTTP methods", () => {
      expect(validateObsidianProxyMethod("get")).toBe("GET");
      expect(validateObsidianProxyMethod("POST")).toBe("POST");
      expect(() => validateObsidianProxyMethod("CONNECT")).toThrow(/não suportado/);
    });
  });

  describe("P0 — Epistemic Logic & Fallback Invariants", () => {
    test("folders without explicit metadata default to HIPÓTESE or PENDENTE, never CONFIRMADO", () => {
      // Crucial test: evaluateEpistemicWeight without explicit metadata
      const bareStrategy = evaluateEpistemicWeight("01_Estrategia");
      expect(bareStrategy.normalizedEpistemicStatus).toBe("HIPÓTESE");
      expect(bareStrategy.isOfficialFact).toBe(false);

      const bareProducts = evaluateEpistemicWeight("02_Produtos");
      expect(bareProducts.normalizedEpistemicStatus).toBe("HIPÓTESE");
      expect(bareProducts.isOfficialFact).toBe(false);

      const bareLearnings = evaluateEpistemicWeight("08_Aprendizados");
      expect(bareLearnings.normalizedEpistemicStatus).toBe("HIPÓTESE");
      expect(bareLearnings.isOfficialFact).toBe(false);

      const bareContent = evaluateEpistemicWeight("03_Conteudos");
      expect(bareContent.normalizedEpistemicStatus).toBe("HIPÓTESE");
      expect(bareContent.isOfficialFact).toBe(false);
    });

    test("unreviewed or newly ingested notes default to PENDENTE even in strategic folders", () => {
      const draftInStrategy = evaluateEpistemicWeight("01_Estrategia", "NOVO", "pendente");
      expect(draftInStrategy.normalizedEpistemicStatus).toBe("PENDENTE");
      expect(draftInStrategy.isOfficialFact).toBe(false);

      const unverifiedInProducts = evaluateEpistemicWeight("02_Produtos", "PENDENTE");
      expect(unverifiedInProducts.normalizedEpistemicStatus).toBe("PENDENTE");
      expect(unverifiedInProducts.isOfficialFact).toBe(false);

      const reviewItem = evaluateEpistemicWeight("01_Estrategia", "EM REVISÃO");
      expect(reviewItem.normalizedEpistemicStatus).toBe("HIPÓTESE");
      expect(reviewItem.isOfficialFact).toBe(false);
    });

    test("only canonically validated notes (OFICIAL / CONFIRMADO) are marked as official truth", () => {
      const canonicalStrategy = evaluateEpistemicWeight("01_Estrategia", "OFICIAL", "confirmado");
      expect(canonicalStrategy.normalizedEpistemicStatus).toBe("CONFIRMADO");
      expect(canonicalStrategy.isOfficialFact).toBe(true);

      const verifiedTruth = evaluateEpistemicWeight("02_Produtos", "OFICIAL", "verified_truth");
      expect(verifiedTruth.normalizedEpistemicStatus).toBe("CONFIRMADO");
      expect(verifiedTruth.isOfficialFact).toBe(true);
    });

    test("inbox captures are strictly raw_capture with PENDENTE status", () => {
      const inboxNote = evaluateEpistemicWeight("00_Inbox");
      expect(inboxNote.normalizedEpistemicStatus).toBe("PENDENTE");
      expect(inboxNote.canonicalStatus).toBe("raw_capture");
      expect(inboxNote.isOfficialFact).toBe(false);
    });
  });
});
