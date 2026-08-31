import http from "http";
import crypto from "crypto";

const LOOPBACK_HOST = "127.0.0.1";
const parsedPort = Number(process.env.NISTI_APP_PORT || 3000);
const APP_PORT = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : 3000;
const APP_ORIGINS = new Set([
  `http://${LOOPBACK_HOST}:${APP_PORT}`,
  `http://localhost:${APP_PORT}`,
]);
const SESSION_TOKEN = process.env.API_SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const INSTANCE_ID = process.env.NISTI_INSTANCE_ID || crypto.randomBytes(16).toString("hex");
const IS_DESKTOP_ENV = process.env.ELECTRON_RUN_AS_NODE === "1" || !!process.env.NISTI_INSTANCE_ID;

const originalListen = (http.Server.prototype as any).listen;
const originalEmit = (http.Server.prototype as any).emit;

function isLoopbackHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.toLowerCase();
  return (
    host === LOOPBACK_HOST ||
    host === "localhost" ||
    host === `${LOOPBACK_HOST}:${APP_PORT}` ||
    host === `localhost:${APP_PORT}`
  );
}

function writeJson(res: http.ServerResponse, statusCode: number, payload: unknown): true {
  res.statusCode = statusCode;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
  return true;
}

let hasBoundMainServer = false;

(http.Server.prototype as any).listen = function (...args: any[]) {
  let isMainServer = false;
  if (typeof args[0] === "object" && args[0] !== null) {
    if (args[0].port === APP_PORT || args[0].port === 3000) {
      isMainServer = true;
    }
  } else if (typeof args[0] === "number") {
    if (args[0] === APP_PORT || args[0] === 3000) {
      isMainServer = true;
    }
  }

  if (isMainServer && !hasBoundMainServer) {
    hasBoundMainServer = true;
    const targetHost = IS_DESKTOP_ENV ? LOOPBACK_HOST : "0.0.0.0";
    if (typeof args[0] === "object" && args[0] !== null) {
      args[0] = { ...args[0], port: APP_PORT, host: targetHost };
    } else if (typeof args[0] === "number") {
      args[0] = APP_PORT;
      if (typeof args[1] === "string") {
        args[1] = targetHost;
      } else {
        args.splice(1, 0, targetHost);
      }
    }
  }
  return originalListen.apply(this, args);
};

(http.Server.prototype as any).emit = function (event: string, ...args: any[]) {
  if (event !== "request") {
    return originalEmit.call(this, event, ...args);
  }

  const req = args[0] as http.IncomingMessage;
  const res = args[1] as http.ServerResponse;
  const url = req.url || "/";

  if (!url.startsWith("/api/")) {
    return originalEmit.call(this, event, ...args);
  }

  if (IS_DESKTOP_ENV && !isLoopbackHost(req.headers.host)) {
    return writeJson(res, 403, { success: false, error: "Host não autorizado." });
  }

  const origin = req.headers.origin;
  if (IS_DESKTOP_ENV && origin && !APP_ORIGINS.has(origin)) {
    return writeJson(res, 403, { success: false, error: "Origem não autorizada." });
  }

  if (url === "/api/health") {
    return writeJson(res, 200, {
      status: "ok",
      hasApiKey: !!(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY),
      runtime: "nisti-secure-local",
      instanceId: INSTANCE_ID,
      timestamp: new Date().toISOString(),
    });
  }

  if (url === "/api/auth/session") {
    const fetchSite = req.headers["sec-fetch-site"];
    if (IS_DESKTOP_ENV && fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
      return writeJson(res, 403, { success: false, error: "Handshake de sessão bloqueado." });
    }
    return writeJson(res, 200, { success: true, token: SESSION_TOKEN });
  }

  if (url === "/api/internal/update-secrets") {
    const internalToken = req.headers["x-nisti-internal-sync-token"];
    const expectedSyncToken = process.env.NISTI_INTERNAL_SYNC_TOKEN;
    if (!expectedSyncToken || internalToken !== expectedSyncToken) {
      return writeJson(res, 403, { success: false, error: "Acesso não autorizado." });
    }
    req.headers["sec-fetch-site"] = "same-origin";
    return originalEmit.call(this, event, ...args);
  }

  const providedToken = String(req.headers["x-app-session-token"] || "");
  if (providedToken !== SESSION_TOKEN) {
    return writeJson(res, 401, { success: false, error: "Sessão local inválida." });
  }

  req.headers["sec-fetch-site"] = "same-origin";
  return originalEmit.call(this, event, ...args);
};

process.env.API_SESSION_SECRET = SESSION_TOKEN;
process.env.NISTI_APP_PORT = String(APP_PORT);
process.env.NISTI_INSTANCE_ID = INSTANCE_ID;

void import("./server.ts");
