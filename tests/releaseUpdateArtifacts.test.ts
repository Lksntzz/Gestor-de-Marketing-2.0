import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

async function read(path: string): Promise<string> {
  return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("Windows release updater artifacts", () => {
  test("NSIS installer uses a stable filename without spaces", async () => {
    const pkg = JSON.parse(await read("package.json"));
    expect(pkg.build.nsis.artifactName).toBe("Nisti-Marketing-Setup-${version}.${ext}");
    expect(pkg.build.nsis.artifactName).not.toContain(" ");
  });

  test("release workflow validates latest.yml locally and remote GitHub asset names", async () => {
    const workflow = await read(".github/workflows/release-windows.yml");
    expect(workflow).toContain("Validate latest.yml Artifact References");
    expect(workflow).toContain("Verify Published Update Feed");
    expect(workflow).toContain("releases/tags/$env:RELEASE_TAG");
    expect(workflow).toContain("Nisti-Marketing-Setup-");
    expect(workflow).not.toContain("uses: actions/upload-artifact");
  });

  test("NSIS smoke retries only the known hosted-runner access violation and remains fail-closed", async () => {
    const workflow = await read(".github/workflows/release-windows.yml");
    expect(workflow).toContain("$accessViolationExitCode = -1073741819");
    expect(workflow).toContain("$maxAttempts = 3");
    expect(workflow).toContain("if ($process.ExitCode -ne $accessViolationExitCode)");
    expect(workflow).toContain("release bloqueada");
  });
});
