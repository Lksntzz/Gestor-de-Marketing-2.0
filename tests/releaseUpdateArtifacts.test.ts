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

  test("Windows abre o Electron e valida renderer, preload e backend antes de publicar", async () => {
    const [releaseWorkflow, windowsWorkflow, smoke, desktop] = await Promise.all([
      read(".github/workflows/release-windows.yml"),
      read(".github/workflows/windows-v2-test.yml"),
      read("scripts/windows-electron-smoke.ps1"),
      read("electron-main.ts"),
    ]);
    for (const workflow of [releaseWorkflow, windowsWorkflow]) {
      expect(workflow).toContain("windows-electron-smoke.ps1");
    }
    expect(windowsWorkflow).toContain("pull_request:");
    expect(smoke).toContain("rendererReady");
    expect(smoke).toContain("preloadReady");
    expect(smoke).toContain("backendReady");
    expect(smoke).toContain("CloseMainWindow");
    expect(desktop).toContain("NISTI_RUNTIME_HEALTH_FILE");
    expect(desktop).toContain("writeRuntimeHealthProbe");
  });
});
