import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";

describe("Obsidian connection authentication contract", () => {
  test("renderer requires authenticated=true instead of accepting HTTP 200 alone", () => {
    const source = readFileSync("src/services/api.ts", "utf8");
    expect(source).toContain("directRes.ok && data?.authenticated === true");
    expect(source).toContain("directRes.ok && data?.authenticated === false");
    expect(source).toContain("API Key não autenticou");
  });

  test("backend connection probe also requires authenticated=true", () => {
    const source = readFileSync("server.ts", "utf8");
    expect(source).toContain("response.ok && payload?.authenticated === true");
    expect(source).toContain("response.ok && payload?.authenticated === false");
  });
});
