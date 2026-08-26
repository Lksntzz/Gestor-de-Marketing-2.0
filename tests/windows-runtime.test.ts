import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

async function read(path: string): Promise<string> {
  return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("Windows packaged runtime", () => {
  test("backend starts with app resources as working directory", async () => {
    const source = await read("electron-bootstrap.ts");
    expect(source).toContain("const appRoot = path.dirname(__dirname)");
    expect(source).toContain("cwd: appRoot");
  });

  test("renderer bundle supports file fallback with relative assets", async () => {
    const source = await read("vite.config.ts");
    expect(source).toContain("base: './'");
  });

  test("desktop window uses Nisti product metadata", async () => {
    const source = await read("index.html");
    expect(source).toContain("<title>Nisti Print Marketing Hub PKM</title>");
    expect(source).not.toContain("My Google AI Studio App");
  });
});
