/**
 * obsidianEndpointValidator.ts
 *
 * Módulo centralizado de validação de segurança e defesa anti-SSRF
 * para conexões com o Obsidian Local REST API.
 */

const ALLOWED_LOOPBACK_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "::1",
  "[::1]",
]);

// Lista de portas locais estritamente permitidas para o Obsidian Local REST API
const ALLOWED_OBSIDIAN_PORTS = new Set([27123, 27124]);

const ALLOWED_HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);

const ALLOWED_FORWARD_HEADERS = new Set([
  "accept",
  "content-type",
  "if-match",
  "if-none-match",
  "accept-encoding",
  "content-length"
]);

export interface ValidatedObsidianEndpoint {
  url: URL;
  protocol: string;
  host: string;
  hostname: string;
  port: number;
}

/**
 * Valida estritamente se uma URL de endpoint aponta exclusivamente para o Obsidian Local REST API
 * rodando em interface loopback na mesma máquina, bloqueando SSRF, domínios externos e portas sensíveis.
 */
export function parseLoopbackEndpoint(endpoint: string): URL {
  if (!endpoint || typeof endpoint !== "string") {
    throw new Error("Endpoint do Obsidian não informado.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(endpoint.trim());
  } catch {
    throw new Error("URL do endpoint Obsidian inválida.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("Protocolo do Obsidian inválido. Apenas HTTP e HTTPS são permitidos.");
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error("Credenciais embutidas na URL do Obsidian não são permitidas.");
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (!ALLOWED_LOOPBACK_HOSTS.has(hostname)) {
    throw new Error(
      `SSRF Bloqueado: O host '${hostname}' não é permitido. Apenas o Obsidian Local REST API em loopback estrito (127.0.0.1 ou localhost) é autorizado.`
    );
  }

  const portStr = parsedUrl.port || (parsedUrl.protocol === "https:" ? "443" : "80");
  const portNum = parseInt(portStr, 10);

  if (Number.isNaN(portNum) || !ALLOWED_OBSIDIAN_PORTS.has(portNum)) {
    throw new Error(`SSRF Bloqueado: A porta '${portStr}' não é autorizada. Apenas as portas padrão do Obsidian Local REST API (27123 ou 27124) são permitidas.`);
  }

  return parsedUrl;
}

function decodePathSegment(segment: string): string {
  let current = segment;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      throw new Error("Codificação inválida detectada no caminho do Obsidian.");
    }
    if (decoded === current) break;
    current = decoded;
  }
  return current;
}

/**
 * Valida e sanitiza o caminho do endpoint no Obsidian REST API.
 *
 * O guard anterior rejeitava qualquer sequência "..", inclusive nomes de arquivo
 * legítimos como "versao..final.md". Aqui a proteção é feita por segmento real de
 * caminho, bloqueando traversal codificado/duplamente codificado sem gerar falso positivo.
 */
export function validateObsidianProxyPath(targetPath: string): string {
  const raw = String(targetPath || "/").trim();

  if (raw.includes("\\") || raw.includes("\0")) {
    throw new Error("Path traversal detectado no caminho do Obsidian.");
  }

  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  const rawSegments = normalized.split("/");
  for (const segment of rawSegments) {
    if (!segment) continue;
    const decoded = decodePathSegment(segment);
    if (
      decoded === "." ||
      decoded === ".." ||
      decoded.includes("/") ||
      decoded.includes("\\") ||
      decoded.includes("\0")
    ) {
      throw new Error("Path traversal detectado no caminho do Obsidian.");
    }
  }

  const isAllowedRoute =
    normalized === "/" ||
    normalized.startsWith("/vault") ||
    normalized.startsWith("/active/") ||
    normalized.startsWith("/open/") ||
    normalized.startsWith("/search/") ||
    normalized.startsWith("/commands/") ||
    normalized.startsWith("/periodic/");

  if (!isAllowedRoute) {
    throw new Error(`Rota '${normalized}' não é uma rota autorizada do Obsidian Local REST API.`);
  }

  return normalized;
}

/**
 * Valida o método HTTP para o proxy do Obsidian.
 */
export function validateObsidianProxyMethod(method: string): string {
  const normalized = String(method || "GET").trim().toUpperCase();
  if (!ALLOWED_HTTP_METHODS.has(normalized)) {
    throw new Error(`Método HTTP '${method}' não suportado para o proxy do Obsidian.`);
  }
  return normalized;
}

/**
 * Sanitiza cabeçalhos encaminhados para o Obsidian.
 * Garante que customHeaders não sobrescreva Authorization, Host ou Content-Type crítico.
 */
export function sanitizeObsidianForwardHeaders(
  customHeaders: Record<string, unknown> | undefined,
  apiKey: string
): Record<string, string> {
  const safeHeaders: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
  };

  if (customHeaders && typeof customHeaders === "object") {
    for (const [key, value] of Object.entries(customHeaders)) {
      const lowerKey = key.toLowerCase().trim();
      if (ALLOWED_FORWARD_HEADERS.has(lowerKey) && typeof value === "string") {
        safeHeaders[key] = value;
      }
    }
  }

  safeHeaders["Authorization"] = `Bearer ${apiKey.trim()}`;

  return safeHeaders;
}
