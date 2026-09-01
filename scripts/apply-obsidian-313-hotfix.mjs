import fs from 'node:fs';

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(before)) throw new Error(`Pattern not found in ${path}`);
  fs.writeFileSync(path, source.replace(before, after), 'utf8');
}

// 1) Connection state is runtime state, not persisted configuration.
replaceOnce(
  'src/services/storage/StorageManager.ts',
  `    const { apiKey, geminiApiKey, openaiApiKey, ...nonSecretConfig } = config;\n    const persistedConfig = {\n      ...nonSecretConfig,\n      aiProvider: config.aiProvider || "gemini",\n      aiModel: config.aiModel || "",\n      connectionStatus: "disconnected" as const,\n      errorMessage: undefined,\n    };\n`,
  `    const { apiKey, geminiApiKey, openaiApiKey } = config;\n    const persistedConfig = {\n      ...this.sanitizeApiConfig(config),\n      aiProvider: config.aiProvider || "gemini",\n      aiModel: config.aiModel || "",\n    };\n`
);

replaceOnce(
  'src/services/storage/StorageManager.ts',
  `    delete sanitizedConfig.openaiApiKey;\n    return sanitizedConfig;\n`,
  `    delete sanitizedConfig.openaiApiKey;\n    delete sanitizedConfig.connectionStatus;\n    delete sanitizedConfig.errorMessage;\n    return sanitizedConfig;\n`
);

// 2) Saving settings must never disconnect an already validated runtime session.
replaceOnce(
  'src/App.tsx',
  `  const updateAndSaveApiConfig = useCallback(\n    (update: ObsidianApiConfig | ((previous: ObsidianApiConfig) => ObsidianApiConfig)) => {\n      setApiConfig((previous) => {\n        const next = typeof update === "function" ? update(previous) : update;\n        window.setTimeout(() => {\n          void storage.saveApiConfig(next);\n          const webCredentialsMissing =\n            !window.electronAPI && (!next.endpoint?.trim() || !next.apiKey?.trim());\n          if (next.connectionStatus !== "connected" || webCredentialsMissing) {\n            api.disconnectObsidianSession("A Base foi desconectada ou sua configuração deixou de ser válida.");\n          }\n        }, 0);\n        return next;\n      });\n    },\n    [],\n  );\n`,
  `  const updateAndSaveApiConfig = useCallback(\n    (update: ObsidianApiConfig | ((previous: ObsidianApiConfig) => ObsidianApiConfig)) => {\n      setApiConfig((previous) => {\n        const requested = typeof update === "function" ? update(previous) : update;\n        const runtimeConnected = api.isObsidianSessionVerified();\n        const next: ObsidianApiConfig = {\n          ...requested,\n          connectionStatus: runtimeConnected\n            ? "connected"\n            : requested.connectionStatus === "error"\n              ? "error"\n              : "disconnected",\n          errorMessage: runtimeConnected ? undefined : requested.errorMessage,\n        };\n        window.setTimeout(() => {\n          void storage.saveApiConfig(next);\n        }, 0);\n        return next;\n      });\n    },\n    [],\n  );\n`
);

replaceOnce(
  'src/App.tsx',
  `      if (!apiConfig.endpoint.trim() || !apiConfig.apiKey.trim()) {\n        throw new Error("Configure o endpoint e a chave do Obsidian Local REST API antes de sincronizar.");\n      }\n`,
  `      if (!apiConfig.endpoint.trim() || (!window.electronAPI && !apiConfig.apiKey.trim())) {\n        throw new Error("Configure o endpoint e a chave do Obsidian Local REST API antes de sincronizar.");\n      }\n`
);

// 3) A heartbeat is a lightweight liveness probe. It must not rescan the Vault,
// and transient/rate-limit failures must not immediately invalidate authentication.
replaceOnce(
  'src/services/api.ts',
  `let obsidianHeartbeat: ReturnType<typeof setInterval> | null = null;\nlet obsidianHeartbeatBusy = false;\n`,
  `let obsidianHeartbeat: ReturnType<typeof setInterval> | null = null;\nlet obsidianHeartbeatBusy = false;\nlet obsidianHeartbeatFailures = 0;\nconst OBSIDIAN_HEARTBEAT_FAILURE_THRESHOLD = 3;\n`
);

replaceOnce(
  'src/services/api.ts',
  `function stopObsidianHeartbeat(): void {\n  if (obsidianHeartbeat) {\n    clearInterval(obsidianHeartbeat);\n    obsidianHeartbeat = null;\n  }\n}\n\nfunction startObsidianHeartbeat(config: { endpoint: string; apiKey: string }): void {\n  stopObsidianHeartbeat();\n  if (typeof window === "undefined") return;\n\n  const liveConfig: ObsidianApiConfig = {\n    ...DEFAULT_API_CONFIG,\n    endpoint: config.endpoint,\n    apiKey: config.apiKey,\n    connectionStatus: "connected",\n  };\n\n  obsidianHeartbeat = setInterval(async () => {\n    if (obsidianHeartbeatBusy) return;\n    obsidianHeartbeatBusy = true;\n    try {\n      const { res, data } = await requestObsidianConnectionTest(liveConfig);\n      if (!res.ok || !data?.success) {\n        stopObsidianHeartbeat();\n        await setDesktopObsidianAuthorization(false);\n        markObsidianRuntimeDisconnected(\n          data?.message || "A conexão com o Obsidian foi perdida. Reconecte para acessar o banco de conhecimento.",\n        );\n        return;\n      }\n\n      try {\n        await triageNistiInbox(liveConfig);\n        await publishCurrentDesktopVaultSnapshot([...NISTI_KNOWLEDGE_FOLDERS], liveConfig);\n      } catch (automationError) {\n        console.warn("Obsidian connected, but automatic knowledge triage failed:", automationError);\n      }\n    } catch (err: any) {\n      stopObsidianHeartbeat();\n      await setDesktopObsidianAuthorization(false);\n      markObsidianRuntimeDisconnected(\n        err.message || "A conexão com o Obsidian foi perdida. Reconecte para acessar o banco de conhecimento.",\n      );\n    } finally {\n      obsidianHeartbeatBusy = false;\n    }\n  }, 20_000);\n}\n`,
  `function stopObsidianHeartbeat(): void {\n  if (obsidianHeartbeat) {\n    clearInterval(obsidianHeartbeat);\n    obsidianHeartbeat = null;\n  }\n  obsidianHeartbeatFailures = 0;\n}\n\nasync function disconnectObsidianAfterHeartbeatFailure(message: string): Promise<void> {\n  stopObsidianHeartbeat();\n  await setDesktopObsidianAuthorization(false);\n  markObsidianRuntimeDisconnected(message);\n}\n\nfunction startObsidianHeartbeat(config: { endpoint: string; apiKey: string }): void {\n  stopObsidianHeartbeat();\n  if (typeof window === "undefined") return;\n\n  const liveConfig: ObsidianApiConfig = {\n    ...DEFAULT_API_CONFIG,\n    endpoint: config.endpoint,\n    apiKey: config.apiKey,\n    connectionStatus: "connected",\n  };\n\n  obsidianHeartbeat = setInterval(async () => {\n    if (obsidianHeartbeatBusy) return;\n    obsidianHeartbeatBusy = true;\n    try {\n      const { res, data } = await requestObsidianConnectionTest(liveConfig);\n      if (res.ok && data?.success) {\n        obsidianHeartbeatFailures = 0;\n        return;\n      }\n\n      const status = Number((res as Response)?.status || data?.status || 0);\n      const message = data?.message || "A conexão com o Obsidian não respondeu ao heartbeat.";\n      if (status === 429) {\n        console.warn("Obsidian heartbeat adiado por limitação temporária do backend local.");\n        return;\n      }\n\n      obsidianHeartbeatFailures += 1;\n      const definitiveAuthenticationFailure = status === 401 || status === 403;\n      if (definitiveAuthenticationFailure || obsidianHeartbeatFailures >= OBSIDIAN_HEARTBEAT_FAILURE_THRESHOLD) {\n        await disconnectObsidianAfterHeartbeatFailure(message);\n      } else {\n        console.warn(\n          `Heartbeat do Obsidian falhou temporariamente (${obsidianHeartbeatFailures}/${OBSIDIAN_HEARTBEAT_FAILURE_THRESHOLD}): ${message}`,\n        );\n      }\n    } catch (err: any) {\n      obsidianHeartbeatFailures += 1;\n      const message = err?.message || "A conexão com o Obsidian não respondeu ao heartbeat.";\n      if (obsidianHeartbeatFailures >= OBSIDIAN_HEARTBEAT_FAILURE_THRESHOLD) {\n        await disconnectObsidianAfterHeartbeatFailure(message);\n      } else {\n        console.warn(\n          `Heartbeat do Obsidian indisponível temporariamente (${obsidianHeartbeatFailures}/${OBSIDIAN_HEARTBEAT_FAILURE_THRESHOLD}): ${message}`,\n        );\n      }\n    } finally {\n      obsidianHeartbeatBusy = false;\n    }\n  }, 30_000);\n}\n`
);

// 4) The generic public API limiter must not throttle authenticated Electron traffic.
replaceOnce(
  'server.ts',
  `app.use("/api/", (req, res, next) => {\n  const ip = req.ip || req.socket.remoteAddress || "unknown";\n`,
  `app.use("/api/", (req, res, next) => {\n  const trustedDesktopSession = String(req.headers["x-app-session-token"] || "") === SERVER_SESSION_SECRET;\n  if (trustedDesktopSession) return next();\n\n  const ip = req.ip || req.socket.remoteAddress || "unknown";\n`
);

// 5) Version alignment.
replaceOnce('package.json', '"version": "3.1.2"', '"version": "3.1.3"');
replaceOnce('src/utils/reliability.ts', 'export const APP_VERSION = "3.1.2";', 'export const APP_VERSION = "3.1.3";');

fs.writeFileSync(
  'tests/obsidianRuntimeStability.test.ts',
  `import { describe, expect, test } from "bun:test";\nimport { readFileSync } from "fs";\n\nfunction normalize(source: string): string {\n  return source.replace(/\\r\\n/g, "\\n");\n}\n\ndescribe("Obsidian runtime connection stability", () => {\n  test("connection status is runtime-only and not persisted as configuration", () => {\n    const source = normalize(readFileSync("src/services/storage/StorageManager.ts", "utf8"));\n    const saveBlock = source.slice(source.indexOf("public async saveApiConfig"), source.indexOf("public async loadApiConfig"));\n    expect(saveBlock).not.toContain('connectionStatus: "disconnected"');\n    expect(source).toContain("delete sanitizedConfig.connectionStatus");\n    expect(source).toContain("delete sanitizedConfig.errorMessage");\n  });\n\n  test("saving settings cannot disconnect an already validated runtime", () => {\n    const source = normalize(readFileSync("src/App.tsx", "utf8"));\n    const start = source.indexOf("const updateAndSaveApiConfig");\n    const end = source.indexOf("useEffect(() =>", start);\n    const block = source.slice(start, end);\n    expect(block).toContain("api.isObsidianSessionVerified()");\n    expect(block).not.toContain("api.disconnectObsidianSession");\n  });\n\n  test("heartbeat is lightweight and tolerates transient failures", () => {\n    const source = normalize(readFileSync("src/services/api.ts", "utf8"));\n    const start = source.indexOf("function startObsidianHeartbeat");\n    const end = source.indexOf("async function verifyObsidianConnection", start);\n    const block = source.slice(start, end);\n    expect(block).toContain("OBSIDIAN_HEARTBEAT_FAILURE_THRESHOLD");\n    expect(block).toContain("status === 429");\n    expect(block).not.toContain("triageNistiInbox(liveConfig)");\n    expect(block).not.toContain("publishCurrentDesktopVaultSnapshot");\n  });\n\n  test("authenticated desktop API traffic is not throttled by the public limiter", () => {\n    const source = normalize(readFileSync("server.ts", "utf8"));\n    expect(source).toContain("trustedDesktopSession");\n    expect(source).toContain("if (trustedDesktopSession) return next()");\n  });\n});\n`,
  'utf8'
);
