import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { AutoUpdateService, UpdateState } from "../src/electron/update/AutoUpdateService";

class MockAppUpdater extends EventEmitter {
  public autoDownload = false;
  public autoInstallOnAppQuit = false;
  public allowDowngrade = false;
  public allowPrerelease = false;
  public checkCalled = false;
  public quitAndInstallCalled = false;
  public quitAndInstallArgs: any[] = [];
  public shouldFailCheck = false;

  async checkForUpdates(): Promise<any> {
    this.checkCalled = true;
    if (this.shouldFailCheck) {
      throw new Error("net::ERR_INTERNET_DISCONNECTED at github.com/releases token=ghp_secret12345");
    }
    return null;
  }

  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void {
    this.quitAndInstallCalled = true;
    this.quitAndInstallArgs = [isSilent, isForceRunAfter];
  }
}

describe("AutoUpdateService - Unit & State Machine Tests", () => {
  test("initializes as disabled in development mode", () => {
    const updater = new MockAppUpdater();
    const service = new AutoUpdateService({
      updater: updater as any,
      isPackaged: false,
      isPortable: false,
      currentVersion: "2.0.0",
    });

    const state = service.getState();
    assert.equal(state.status, "disabled");
    assert.equal(state.disabledReason, "development");
    assert.equal(state.currentVersion, "2.0.0");
    service.destroy();
  });

  test("initializes as disabled in portable mode even if packaged", () => {
    const updater = new MockAppUpdater();
    const service = new AutoUpdateService({
      updater: updater as any,
      isPackaged: true,
      isPortable: true,
      currentVersion: "2.0.0",
    });

    const state = service.getState();
    assert.equal(state.status, "disabled");
    assert.equal(state.disabledReason, "portable");
    service.destroy();
  });

  test("initializes in idle state for packaged NSIS app", () => {
    const updater = new MockAppUpdater();
    const service = new AutoUpdateService({
      updater: updater as any,
      isPackaged: true,
      isPortable: false,
      currentVersion: "2.0.0",
    });

    const state = service.getState();
    assert.equal(state.status, "idle");
    assert.equal(state.currentVersion, "2.0.0");
    assert.equal(updater.autoDownload, true);
    assert.equal(updater.autoInstallOnAppQuit, true);
    assert.equal(updater.allowDowngrade, false);
    assert.equal(updater.allowPrerelease, false);
    service.destroy();
  });

  test("transitions through full update lifecycle correctly", () => {
    const updater = new MockAppUpdater();
    const service = new AutoUpdateService({
      updater: updater as any,
      isPackaged: true,
      isPortable: false,
      currentVersion: "2.0.0",
    });

    // 1. Checking for update
    updater.emit("checking-for-update");
    assert.equal(service.getState().status, "checking");

    // 2. Update available
    updater.emit("update-available", { version: "2.0.1", releaseDate: "2026-08-28" });
    let state = service.getState();
    assert.equal(state.status, "available");
    assert.equal(state.availableVersion, "2.0.1");
    assert.equal(state.releaseDate, "2026-08-28");

    // 3. Download progress
    updater.emit("download-progress", {
      percent: 45.67,
      transferred: 45000000,
      total: 100000000,
      bytesPerSecond: 5000000,
    });
    state = service.getState();
    assert.equal(state.status, "downloading");
    assert.equal(state.percent, 45.7);
    assert.equal(state.transferred, 45000000);
    assert.equal(state.total, 100000000);

    // 4. Update downloaded
    updater.emit("update-downloaded", { version: "2.0.1", releaseDate: "2026-08-28" });
    state = service.getState();
    assert.equal(state.status, "downloaded");
    assert.equal(state.percent, 100);
    assert.equal(state.availableVersion, "2.0.1");

    service.destroy();
  });

  test("transitions to up-to-date when no update is found", () => {
    const updater = new MockAppUpdater();
    const service = new AutoUpdateService({
      updater: updater as any,
      isPackaged: true,
      isPortable: false,
      currentVersion: "2.0.0",
    });

    updater.emit("update-not-available", { version: "2.0.0" });
    const state = service.getState();
    assert.equal(state.status, "up-to-date");
    assert.equal(state.currentVersion, "2.0.0");
    service.destroy();
  });

  test("sanitizes error messages on network failure and removes secrets", () => {
    const updater = new MockAppUpdater();
    const service = new AutoUpdateService({
      updater: updater as any,
      isPackaged: true,
      isPortable: false,
      currentVersion: "2.0.0",
    });

    updater.emit("error", new Error("net::ERR_CONNECTION_REFUSED with token=ghp_999999"));
    const state = service.getState();
    assert.equal(state.status, "error");
    assert.equal(state.errorMessage?.includes("ghp_999999"), false);
    assert.match(state.errorMessage || "", /conexão/i);

    service.destroy();
  });

  test("manual checkForUpdates triggers updater check and handles exceptions", async () => {
    const updater = new MockAppUpdater();
    const service = new AutoUpdateService({
      updater: updater as any,
      isPackaged: true,
      isPortable: false,
      currentVersion: "2.0.0",
    });

    await service.checkForUpdates();
    assert.equal(updater.checkCalled, true);

    // Test failure scenario
    updater.shouldFailCheck = true;
    const errState = await service.checkForUpdates();
    assert.equal(errState.status, "error");
    assert.equal(errState.errorMessage?.includes("ghp_secret"), false);

    service.destroy();
  });

  test("installUpdate executes cleanup handler before quitAndInstall", async () => {
    const updater = new MockAppUpdater();
    let cleanupCalled = false;

    const service = new AutoUpdateService({
      updater: updater as any,
      isPackaged: true,
      isPortable: false,
      currentVersion: "2.0.0",
      cleanup: async () => {
        cleanupCalled = true;
      },
    });

    // Attempt before download must fail
    const prematureResult = await service.installUpdate();
    assert.equal(prematureResult.success, false);
    assert.equal(cleanupCalled, false);
    assert.equal(updater.quitAndInstallCalled, false);

    // Transition to downloaded
    updater.emit("update-downloaded", { version: "2.0.1" });
    assert.equal(service.getState().status, "downloaded");

    // Successful install
    const successResult = await service.installUpdate();
    assert.equal(successResult.success, true);
    assert.equal(cleanupCalled, true);
    assert.equal(updater.quitAndInstallCalled, true);
    assert.deepEqual(updater.quitAndInstallArgs, [false, true]);

    service.destroy();
  });

  test("background timers are safely cleared on destroy", () => {
    const updater = new MockAppUpdater();
    const service = new AutoUpdateService({
      updater: updater as any,
      isPackaged: true,
      isPortable: false,
      currentVersion: "2.0.0",
      checkIntervalMs: 5000,
      initialCheckDelayMs: 1000,
    });

    service.startBackgroundChecks();
    service.destroy();
    assert.equal(service.getState().status, "idle");
  });
});
