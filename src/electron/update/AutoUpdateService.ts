import type { AppUpdater, UpdateInfo, ProgressInfo } from "electron-updater";

function getElectronApp(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electron = typeof require !== "undefined" ? require("electron") : null;
    return electron?.app;
  } catch {
    return undefined;
  }
}

function getElectronBrowserWindow(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electron = typeof require !== "undefined" ? require("electron") : null;
    return electron?.BrowserWindow;
  } catch {
    return undefined;
  }
}

function getDefaultAutoUpdater(): AppUpdater | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const updaterPkg = typeof require !== "undefined" ? require("electron-updater") : null;
    return updaterPkg?.autoUpdater || null;
  } catch {
    return null;
  }
}

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "up-to-date"
  | "error"
  | "disabled";

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion?: string;
  releaseDate?: string;
  percent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
  errorMessage?: string;
  disabledReason?: "development" | "portable";
}

export type CleanupHandler = () => Promise<void> | void;

export interface AutoUpdateServiceOptions {
  updater?: AppUpdater;
  isPackaged?: boolean;
  isPortable?: boolean;
  currentVersion?: string;
  checkIntervalMs?: number;
  initialCheckDelayMs?: number;
  cleanup?: CleanupHandler;
}

export class AutoUpdateService {
  private static instance: AutoUpdateService | null = null;
  private readonly updater: AppUpdater;
  private readonly isPackaged: boolean;
  private readonly isPortable: boolean;
  private readonly checkIntervalMs: number;
  private readonly initialCheckDelayMs: number;
  private cleanupHandler?: CleanupHandler;

  private state: UpdateState;
  private checkTimer: NodeJS.Timeout | null = null;
  private initialCheckTimeout: NodeJS.Timeout | null = null;
  private isChecking = false;
  private isDestroyed = false;

  constructor(options?: AutoUpdateServiceOptions) {
    const electronApp = getElectronApp();
    this.isPackaged = options?.isPackaged ?? (electronApp ? Boolean(electronApp.isPackaged) : false);
    this.isPortable = options?.isPortable ?? Boolean(
      process.env.PORTABLE_EXECUTABLE_FILE || process.env.PORTABLE_EXECUTABLE_DIR
    );
    this.updater = options?.updater ?? (getDefaultAutoUpdater() as AppUpdater);
    this.checkIntervalMs = options?.checkIntervalMs ?? (4 * 60 * 60 * 1000); // 4 horas
    this.initialCheckDelayMs = options?.initialCheckDelayMs ?? (8 * 1000); // 8 segundos
    this.cleanupHandler = options?.cleanup;

    const currentVer = options?.currentVersion || (electronApp ? electronApp.getVersion() : "2.0.0");

    if (!this.isPackaged) {
      this.state = {
        status: "disabled",
        currentVersion: currentVer,
        disabledReason: "development",
      };
    } else if (this.isPortable) {
      this.state = {
        status: "disabled",
        currentVersion: currentVer,
        disabledReason: "portable",
      };
    } else {
      this.state = {
        status: "idle",
        currentVersion: currentVer,
      };
    }

    this.configureUpdater();
  }

  public static getInstance(options?: AutoUpdateServiceOptions): AutoUpdateService {
    if (!AutoUpdateService.instance) {
      AutoUpdateService.instance = new AutoUpdateService(options);
    }
    return AutoUpdateService.instance;
  }

  public static resetInstance(): void {
    if (AutoUpdateService.instance) {
      AutoUpdateService.instance.destroy();
      AutoUpdateService.instance = null;
    }
  }

  public setCleanupHandler(handler: CleanupHandler): void {
    this.cleanupHandler = handler;
  }

  private configureUpdater(): void {
    if (this.state.status === "disabled") {
      return;
    }

    try {
      this.updater.autoDownload = true;
      this.updater.autoInstallOnAppQuit = true;
      this.updater.allowDowngrade = false;
      this.updater.allowPrerelease = false;

      this.updater.on("checking-for-update", () => {
        this.updateState({
          status: "checking",
          errorMessage: undefined,
        });
      });

      this.updater.on("update-available", (info: UpdateInfo) => {
        this.updateState({
          status: "available",
          availableVersion: info?.version,
          releaseDate: typeof info?.releaseDate === "string" ? info.releaseDate : undefined,
          errorMessage: undefined,
        });
      });

      this.updater.on("update-not-available", (info: UpdateInfo) => {
        this.updateState({
          status: "up-to-date",
          availableVersion: info?.version || this.state.currentVersion,
          errorMessage: undefined,
        });
      });

      this.updater.on("download-progress", (progress: ProgressInfo) => {
        this.updateState({
          status: "downloading",
          percent: Math.round((progress.percent || 0) * 10) / 10,
          transferred: progress.transferred,
          total: progress.total,
          bytesPerSecond: progress.bytesPerSecond,
          errorMessage: undefined,
        });
      });

      this.updater.on("update-downloaded", (info: UpdateInfo) => {
        this.updateState({
          status: "downloaded",
          availableVersion: info?.version,
          releaseDate: typeof info?.releaseDate === "string" ? info.releaseDate : undefined,
          percent: 100,
          errorMessage: undefined,
        });
      });

      this.updater.on("error", (err: Error) => {
        // Sanitiza a mensagem de erro para não vazar stack traces internas nem tokens
        const cleanMsg = this.sanitizeErrorMessage(err?.message || "Erro de conexão ao verificar atualizações.");
        this.updateState({
          status: "error",
          errorMessage: cleanMsg,
        });
      });
    } catch (err: any) {
      console.warn("Falha ao configurar electron-updater:", err?.message);
    }
  }

  private sanitizeErrorMessage(msg: string): string {
    if (!msg) return "Não foi possível verificar atualizações.";
    // Remove potenciais tokens, URLs privadas ou stack trace
    let safe = msg.replace(/token=[a-zA-Z0-9_\-]+/gi, "token=***");
    safe = safe.replace(/Bearer\s+[a-zA-Z0-9_\-]+/gi, "Bearer ***");
    if (safe.includes("net::ERR") || safe.includes("ENOTFOUND") || safe.includes("ECONNREFUSED") || safe.includes("ETIMEDOUT")) {
      return "Não foi possível conectar ao servidor de atualizações. Verifique sua conexão à internet.";
    }
    if (safe.includes("404") || safe.includes("latest.yml")) {
      return "Servidor de atualizações indisponível ou nenhuma release publicada.";
    }
    // Trunca mensagens excessivamente longas
    return safe.slice(0, 160);
  }

  private updateState(partial: Partial<UpdateState>): void {
    this.state = {
      ...this.state,
      ...partial,
    };
    this.broadcastStatus();
  }

  private broadcastStatus(): void {
    const BrowserWindow = getElectronBrowserWindow();
    if (!BrowserWindow || typeof BrowserWindow.getAllWindows !== "function") return;
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        try {
          win.webContents.send("update:status", this.getState());
        } catch {
          // Janela pode estar sendo destruída
        }
      }
    }
  }

  public getState(): UpdateState {
    return { ...this.state };
  }

  public startBackgroundChecks(): void {
    if (this.state.status === "disabled" || this.isDestroyed) {
      return;
    }

    if (this.initialCheckTimeout) {
      clearTimeout(this.initialCheckTimeout);
    }
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }

    // Delay inicial após inicialização
    this.initialCheckTimeout = setTimeout(() => {
      void this.checkForUpdates();
    }, this.initialCheckDelayMs);

    // Verificação periódica conservadora
    this.checkTimer = setInterval(() => {
      void this.checkForUpdates();
    }, this.checkIntervalMs);
  }

  public async checkForUpdates(): Promise<UpdateState> {
    if (this.state.status === "disabled") {
      return this.getState();
    }

    if (this.isChecking || this.state.status === "downloading") {
      return this.getState();
    }

    this.isChecking = true;
    this.updateState({ status: "checking", errorMessage: undefined });

    try {
      if (typeof this.updater.checkForUpdates === "function") {
        await this.updater.checkForUpdates();
      }
    } catch (err: any) {
      const cleanMsg = this.sanitizeErrorMessage(err?.message);
      this.updateState({ status: "error", errorMessage: cleanMsg });
    } finally {
      this.isChecking = false;
    }

    return this.getState();
  }

  public async installUpdate(): Promise<{ success: boolean; error?: string }> {
    if (this.state.status !== "downloaded") {
      return {
        success: false,
        error: "Nenhuma atualização baixada pronta para instalação.",
      };
    }

    try {
      // 1. Executa cleanup prévio de todos os recursos (SQLite, Watcher, Backend Child Process)
      if (this.cleanupHandler) {
        await Promise.resolve(this.cleanupHandler());
      }

      // 2. Invoca quitAndInstall (isSilent = false, isForceRunAfter = true)
      if (typeof this.updater.quitAndInstall === "function") {
        this.updater.quitAndInstall(false, true);
        return { success: true };
      }

      return { success: false, error: "Método quitAndInstall indisponível no updater." };
    } catch (err: any) {
      return {
        success: false,
        error: this.sanitizeErrorMessage(err?.message || "Falha ao instalar atualização."),
      };
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.initialCheckTimeout) {
      clearTimeout(this.initialCheckTimeout);
      this.initialCheckTimeout = null;
    }
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }
}
