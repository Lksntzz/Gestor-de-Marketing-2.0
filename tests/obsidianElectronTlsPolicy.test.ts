import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";

describe("Obsidian Electron TLS policy", () => {
  const source = readFileSync("electron-bootstrap.ts", "utf8");

  test("trusts only the official Local REST API HTTPS loopback endpoint", () => {
    expect(source).toContain("127.0.0.1:27124");
    expect(source).toContain("localhost:27124");
    expect(source).toContain("TRUSTED_OBSIDIAN_TLS_ENDPOINTS.has(target.host)");
    expect(source).toContain("target.protocol === \"https:\"");
  });

  test("does not disable TLS verification globally", () => {
    expect(source).not.toContain("NODE_TLS_REJECT_UNAUTHORIZED");
    expect(source).not.toContain("rejectUnauthorized: false");
    expect(source).toContain("callback(false)");
  });
});
