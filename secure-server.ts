import http from "http";
import crypto from "crypto";

const LOOPBACK_HOST = "127.0.0.1";
const APP_PORT = 3000;
const APP_ORIGINS = new Set([
  `http://${LOOPBACK_HOST}:${APP_PORT}`,
  `http://localhost:${APP_PORT}`,
]);
const SESSION_TOKEN = process.env.API_SESSION_SECRET || crypto.randomBytes(32).toString("hex");

const originalListen = (http.Server.prototype as any).listen;
const originalEmit = (http.Server.prototype as any).emit;

function isLoopbackHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.toLowerCase();
  return host === LOOPBACK_HOST || host === "localhost" || host.startsWith(`${LOOPBACK_HOST}:`) || host.startsWith("localhost:");
}

(http.Server.prototype as any).listen = function (...args: any[]) {
  if (typeof args[0] === "object" && args[0] !== null) {
    args[0] = { ...args[0], host: LOOPBACK_HOST };
  } else if (typeof args[0] === "number") {
    if (typeof args[1] === "string") {
      args[1] = LOOPBACK_HOST;
    } else {
      args.splice(1, 0, LOOPBACK_HOST);
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

  if (!isLoopbackHost(req.headers.host)) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: false, error: "Host não autorizado." }));
    return true;
  }

  const origin = req.headers.origin;
  if (origin && !APP_ORIGINS.has(origin)) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: false, error: "Origem não autorizada." }));
    return true;
  }

  if (url === "/api/auth/session") {
    const fetchSite = req.headers["sec-fetch-site"];
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
      res.statusCode = 403;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: false, error: "Handshake de sessão bloqueado." }));
      return true;
    }

    res.statusCode = 200;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: true, token: SESSION_TOKEN }));
    return true;
  }

  if (url !== "/api/health") {
    const providedToken = String(req.headers["x-app-session-token"] || "");
    const fetchSite = req.headers["sec-fetch-site"];
    const sameOriginBrowser = fetchSite === "same-origin";

    if (providedToken !== SESSION_TOKEN && !sameOriginBrowser) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: false, error: "Sessão local inválida." }));
      return true;
    }

    if (providedToken === SESSION_TOKEN) {
      req.headers["sec-fetch-site"] = "same-origin";
    }
  }

  return originalEmit.call(this, event, ...args);
};

process.env.API_SESSION_SECRET = SESSION_TOKEN;

void import("./server.ts");
