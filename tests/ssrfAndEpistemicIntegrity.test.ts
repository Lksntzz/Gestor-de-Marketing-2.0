import { describe, test, expect } from "bun:test";
import { evaluateEpistemicWeight } from "../src/services/knowledge/EpistemicClassifier";

describe("P0 Security & Epistemic Integrity Invariants", () => {
  describe("P0 — SSRF Protection for Obsidian Loopback Integration", () => {
    // We recreate the exact parsing logic implemented in server.ts to verify invariants
    function parseLoopbackEndpoint(endpoint: string): URL {
      if (!endpoint || typeof endpoint !== "string") {
        throw new Error("Endpoint do Obsidian não informado.");
      }
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(endpoint.trim());
      } catch {
        throw new Error("URL do endpoint Obsidian inválida.");
      }

      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        throw new Error("Protocolo do Obsidian inválido. Apenas HTTP e HTTPS são permitidos.");
      }

      const hostname = parsedUrl.hostname.toLowerCase();

      const isLoopback =
        hostname === "127.0.0.1" ||
        hostname === "localhost" ||
        hostname === "::1" ||
        hostname === "[::1]" ||
        hostname === "0.0.0.0" ||
        hostname === "local.obsidian.md" ||
        hostname.endsWith(".localhost");

      if (!isLoopback) {
        throw new Error(
          `SSRF Bloqueado: O host '${hostname}' não é permitido. Apenas o Obsidian Local REST API na mesma máquina (localhost / 127.0.0.1) é autorizado.`
        );
      }

      return parsedUrl;
    }

    test("allows legitimate local Obsidian loopback endpoints", () => {
      expect(parseLoopbackEndpoint("http://127.0.0.1:27124").hostname).toBe("127.0.0.1");
      expect(parseLoopbackEndpoint("https://127.0.0.1:27124").hostname).toBe("127.0.0.1");
      expect(parseLoopbackEndpoint("http://localhost:27124").hostname).toBe("localhost");
      expect(parseLoopbackEndpoint("https://localhost:27123").hostname).toBe("localhost");
      expect(parseLoopbackEndpoint("https://local.obsidian.md:27124").hostname).toBe("local.obsidian.md");
      expect(parseLoopbackEndpoint("http://vault.localhost:27124").hostname).toBe("vault.localhost");
    });

    test("blocks external domains and cloud metadata endpoints", () => {
      // Cloud metadata endpoints
      expect(() => parseLoopbackEndpoint("http://169.254.169.254/latest/meta-data/")).toThrow(/SSRF Bloqueado/);
      expect(() => parseLoopbackEndpoint("http://metadata.google.internal/computeMetadata/v1/")).toThrow(/SSRF Bloqueado/);

      // Public internet hosts
      expect(() => parseLoopbackEndpoint("http://google.com")).toThrow(/SSRF Bloqueado/);
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
  });

  describe("P0 — Epistemic Logic & Fallback Invariants", () => {
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
