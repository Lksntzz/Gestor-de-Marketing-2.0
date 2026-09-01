import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";

function normalize(source: string): string {
  return source.replace(/\r\n/g, "\n");
}

describe("Obsidian runtime connection stability", () => {
  test("connection status is runtime-only and not persisted as configuration", () => {
    const source = normalize(readFileSync("src/services/storage/StorageManager.ts", "utf8"));
    const saveBlock = source.slice(source.indexOf("public async saveApiConfig"), source.indexOf("public async loadApiConfig"));
    expect(saveBlock).not.toContain('connectionStatus: "disconnected"');
    expect(source).toContain("delete sanitizedConfig.connectionStatus");
    expect(source).toContain("delete sanitizedConfig.errorMessage");
  });

  test("saving settings cannot disconnect an already validated runtime", () => {
    const source = normalize(readFileSync("src/App.tsx", "utf8"));
    const start = source.indexOf("const updateAndSaveApiConfig");
    const end = source.indexOf("useEffect(() =>", start);
    const block = source.slice(start, end);
    expect(block).toContain("api.isObsidianSessionVerified()");
    expect(block).not.toContain("api.disconnectObsidianSession");
  });

  test("authenticated transport is not revoked by Base preparation failures", () => {
    const source = normalize(readFileSync("src/services/api.ts", "utf8"));
    const start = source.indexOf("async function verifyObsidianConnection");
    const end = source.indexOf("async function requireVerifiedObsidian", start);
    const block = source.slice(start, end);
    const authBoundary = block.indexOf("markObsidianRuntimeConnected()");
    const preparationBoundary = block.indexOf("ensureNistiRemoteStructure", authBoundary);
    expect(authBoundary).toBeGreaterThan(-1);
    expect(preparationBoundary).toBeGreaterThan(authBoundary);
    expect(block.slice(preparationBoundary)).not.toContain("markObsidianRuntimeDisconnected");
    expect(block).toContain("preparationWarnings");
  });

  test("heartbeat is lightweight and tolerates transient failures", () => {
    const source = normalize(readFileSync("src/services/api.ts", "utf8"));
    const start = source.indexOf("function startObsidianHeartbeat");
    const end = source.indexOf("async function verifyObsidianConnection", start);
    const block = source.slice(start, end);
    expect(block).toContain("OBSIDIAN_HEARTBEAT_FAILURE_THRESHOLD");
    expect(block).toContain("status === 429");
    expect(block).not.toContain("triageNistiInbox(liveConfig)");
    expect(block).not.toContain("publishCurrentDesktopVaultSnapshot");
  });

  test("authenticated desktop API traffic is not throttled by the public limiter", () => {
    const source = normalize(readFileSync("server.ts", "utf8"));
    expect(source).toContain("trustedDesktopSession");
    expect(source).toContain("if (trustedDesktopSession) return next()");
  });
});
