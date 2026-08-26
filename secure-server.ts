import http from "http";
import https from "https";
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
const originalFetch = globalThis.fetch.bind(globalThis);

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1";
}

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

function headersToObject(headers: HeadersInit | undefined): Record<string, string> {
  const normalized = new Headers(headers || {});
  return Object.fromEntries(normalized.entries());
}

function localHttpsFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !isLoopbackHostname(parsed.hostname)) {
    return originalFetch(url, init);
  }

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        protocol: "https:",
        hostname: parsed.hostname.replace(/^\[|\]$/g, ""),
        port: parsed.port ? Number(parsed.port) : 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: init.method || "GET",
        headers: headersToObject(init.headers),
        rejectUnauthorized: false,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on("end", () => {
          const responseHeaders = new Headers();
          for (const [name, value] of Object.entries(response.headers)) {
            if (Array.isArray(value)) {
              value.forEach((item) => responseHeaders.append(name, item));
            } else if (value !== undefined) {
              responseHeaders.set(name, String(value));
            }
          }
          resolve(
            new Response(Buffer.concat(chunks), {
              status: response.statusCode || 500,
              statusText: response.statusMessage || "",
              headers: responseHeaders,
            })
          );
        });
      }
    );

    request.on("error", reject);

    if (init.signal) {
      const abort = () => request.destroy(new Error("Request aborted"));
      if (init.signal.aborted) {
        abort();
        return;
      }
      init.signal.addEventListener("abort", abort, { once: true });
      request.once("close", () => init.signal?.removeEventListener("abort", abort));
    }

    const body = init.body;
    if (body == null) {
      request.end();
      return;
    }

    if (typeof body === "string" || Buffer.isBuffer(body)) {
      request.end(body);
      return;
    }

    if (body instanceof URLSearchParams) {
      request.end(body.toString());
      return;
    }

    if (body instanceof ArrayBuffer) {
      request.end(Buffer.from(body));
      return;
    }

    if (ArrayBuffer.isView(body)) {
      request.end(Buffer.from(body.buffer, body.byteOffset, body.byteLength));
      return;
    }

    request.destroy(new Error("Unsupported request body for local HTTPS request."));
  });
}

// Obsidian Local REST API normally listens on HTTPS 27124 with a self-signed
// certificate. Because the target is strictly loopback, we can accept that
// certificate without weakening TLS for any external destination. For older
// saved configs that still say http://127.0.0.1:27124, retry HTTPS only when
// the HTTP connection itself cannot be established.
globalThis.fetch = async (input: any, init?: RequestInit): Promise<Response> => {
  const rawUrl =
    typeof input === "string" || input instanceof URL
      ? String(input)
      : typeof input?.url === "string"
      ? input.url
      : "";

  if (!rawUrl) return originalFetch(input, init);

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return originalFetch(input, init);
  }

  if (!isLoopbackHostname(parsed.hostname)) {
    return originalFetch(input, init);
  }

  if (parsed.protocol === "https:") {
    return localHttpsFetch(parsed.toString(), init || {});
  }

  if (parsed.protocol === "http:" && parsed.port === "27124") {
    try {
      return await originalFetch(input, init);
    } catch {
      parsed.protocol = "https:";
      return localHttpsFetch(parsed.toString(), init || {});
    }
  }

  return originalFetch(input, init);
};

let hasBoundMainServer = false;

(http.Server.prototype as any).listen = function (...args: any[]) {
  if (!hasBoundMainServer) {
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
      hasApiKey: !!process.env.GEMINI_API_KEY,
      runtime: "nisti-secure-local",
      instanceId: INSTANCE_ID,
      timestamp: new Date().toISOString(),
    });
  }

  if (url === "/api/auth/session") {
    const fetchSite = req.headers["sec-fetch-site"];
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
      return writeJson(res, 403, { success: false, error: "Handshake de sessão bloqueado." });
    }
    return writeJson(res, 200, { success: true, token: SESSION_TOKEN });
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
