import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const reliability = readFileSync("src/utils/reliability.ts", "utf8");
const bootstrap = readFileSync("electron-bootstrap.ts", "utf8");
const updater = readFileSync("src/electron/update/AutoUpdateService.ts", "utf8");
const preload = readFileSync("src/preload.ts", "utf8");

describe("desktop update persistence", () => {
  test("keeps release versions aligned", () => {
    const runtimeVersion = reliability.match(/APP_VERSION\s*=\s*"([^"]+)"/)?.[1];
    expect(runtimeVersion).toBe(pkg.version);
  });

  test("uses a stable renderer origin with a safe fallback", () => {
    expect(bootstrap).toContain("const STABLE_RENDERER_PORT = 47831");
    expect(bootstrap).toContain("return await reservePort(STABLE_RENDERER_PORT)");
    expect(bootstrap).toContain('error?.code !== "EADDRINUSE"');
    expect(bootstrap).toContain("return reservePort(0)");
    expect(bootstrap).toContain('const STABLE_USER_DATA_NAME = "Nisti Print PKM Marketing Hub"');
  });

  test("migrates renderer state through a one-time encrypted snapshot", () => {
    expect(updater).toContain('UPDATE_RENDERER_STATE_FILE = "nisti_update_renderer_state.enc"');
    expect(updater).toContain("secureStorage.encryptString(serialized)");
    expect(updater).toContain("await this.snapshotRendererStateForUpdate()");
    expect(bootstrap).toContain('ipcMain.on("renderer-state:bootstrap"');
    expect(bootstrap).toContain("safeStorage.decryptString");
    expect(bootstrap).toContain("unlinkSync(filePath)");
    expect(preload).toContain('ipcRenderer.sendSync("renderer-state:bootstrap")');
    expect(preload.indexOf("restoreRendererStateAfterUpdate();")).toBeLessThan(
      preload.indexOf('contextBridge.exposeInMainWorld("electronAPI"'),
    );
  });

  test("preserves automatic relaunch and gives update feedback", () => {
    expect(updater).toContain("this.updater.quitAndInstall(true, true)");
    expect(preload).toContain('const UPDATE_OVERLAY_ID = "nisti-desktop-update-overlay"');
    expect(preload).toContain("Suas configurações e conexões estão sendo preservadas");
    expect(preload).toContain("ensureUpdateOverlay();");
  });

  test("does not move API keys out of safeStorage", () => {
    expect(bootstrap).toContain("safeStorage.encryptString(nextValue)");
    expect(bootstrap).toContain("nisti_secure_secrets.json");
    expect(updater).not.toContain("obsidianApiKey:");
    expect(updater).not.toContain("geminiApiKey:");
    expect(updater).not.toContain("openaiApiKey:");
  });
});
